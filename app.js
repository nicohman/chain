var io = require('socket.io');
var socketclient = require('socket.io-client');
var ip = require('ip');
var format = require('biguint-format');
var FlakeId = require('flake-idgen');
var bcrypt = require('bcrypt');
var ports = ["2000", "3000", "4000", "5000", "6000"];
var wildcard = require("socketio-wildcard");
var middleware = wildcard();
var patch = require("socketio-wildcard")(socketclient.Manager);
var fs = require("fs");
var names = ["dragon", "defiant", "dragon's teeth", "saint", "weaver"];
var semaphore = require('semaphore');
var sem = semaphore(1);
var selfId = format(new FlakeId({
    datacenter: 1,
    worker: parseInt(process.argv[2])
}).next(), "dec");
var shahash = require('crypto');
var clients = [];
var users = require("./users.json");
var posts = require('./posts.json');
console.log(selfId)
var jwt = require("jsonwebtoken");
var name = names[parseInt(process.argv[2])];
console.log("I am the " + name);
var port = ports[parseInt(process.argv[2]) - 1];
console.log(port);
var secret = "shut up";
var reg = {};
reg[selfId] = {
    name: name,
    ip: ip.address(),
    id: selfId
};
var logged = {};

function hash(data) {
    return shahash.createHash('sha1').update(data, 'utf-8').digest('hex');
}
var globsocket;
if (port != undefined) {
    var to_connect = 'http://localhost:' + port;
    createClient(to_connect);
} else {
    console.log("First!");
}
var to_open = ports[parseInt(process.argv[2])];
console.log(to_open);
io = io(to_open);
io.use(middleware);
var adjacent = [];
io.set('log level', false)

function getDir(id) {
    var index = -1;
    adjacent.forEach(function(newid, newindex) {
        if (newid.id === id) {
            index = newindex;
        }
    });
    return index;
}

function get_user(uid, cb) {
    if (users[uid]) {
        cb(users[uid]);
    } else {
        alldir('get_user', {
            from: selfId,
            original: selfId,
            uid: uid,
            condition: 'fulfill'
        });
        io.once('got_user_' + uid, function(got) {
            cb(got);
        });
    }
}

function flip(dir) {
    switch (dir) {
        case 0:
            return 1;
            break;
        case 1:
            return 0;
            break;
    }
}

function passAlong(eventname, data) {
    var from = flip(getDir(data.from));
    console.log(from + " " + from);
    data.from = selfId;
    onedir(eventname, data, from);
}

function alldir(eventname, data) {
    console.log(clients);
    clients.forEach(function(client) {
        //console.log("emit");
        client.emit(eventname, data);
    });
    io.emit(eventname, data);
}

function onedir(eventname, data, dir) {
    console.log(dir);
    console.log(clients);
    if (clients[dir]) {
        clients[dir].emit(eventname, data);
    } else {
        console.log("no hi");
        io.emit(eventname, data);
    }
}

function createPost(post) {
    var id = hash(post.title + post.auth + Date.now());
    console.log("post");
    posts[id] = {
        id: id,
        title: post.title,
        auth: post.auth,
        date: Date.now(),
        tags: post.tags,
        content: post.content,
        comments: []
    }
    updatePosts();
    alldir("update_posts", posts[id]);
}

function updatePosts() {
    sem.take(function() {
        var usersstring = JSON.stringify(posts);
        fs.writeFile('posts.json', usersstring, function(err) {
            if (err) {
                console.log("Error creating user");
            } else {
                console.log("Created user successfully");
            }
            sem.leave();
        });
    })


};

function addComment(comment) {
    if (posts[comment.postid]) {
        posts.comments.push(comment);
    }
}

function dirToString(dir) {
    switch (dir) {
        case -1:
            return "neither"
            break;
        case 0:
            return "left"
            break;
        case 1:
            return "right"
            break;
    }
}

function when(eventname, cb) {
    clients.forEach(function(client) {
        console.log("whenening");
        client.on(eventname, function(data) {
            //never(eventname);
            console.log("whened " + eventname + getDir(data.from));
            cb(data);
        });
    })
    io.on(eventname, function(data) {
        console.log("whened" + eventname + getDir(data.from));
        console.log(getDir(data.from));
        // never(eventname);
        cb(data)
    });
}

function whenonce(eventname, cb) {
    clients.forEach(function(client) {
        console.log("whenening");
        client.on(eventname, function(data) {
            //never(eventname);
            console.log("whened " + eventname + getDir(data.from));
            cb(data);
        });
    })
    io.on(eventname, function(data) {
        console.log("whened" + eventname + getDir(data.from));
        console.log(getDir(data.from));
        // never(eventname);
        cb(data)
    });

}

function never(eventname) {
    clients.forEach(function(client) {
        client.removeAllListeners(eventname);
    });
    io.removeAllListeners(eventname);
}

function get_posts(criterion, cb) {
    Object.keys(posts).forEach(function(key) {
        var post = posts[key]
        switch (criterion.filter) {
            case 'tag':
                if (criterion.posts.length < criterion.count) {
                    post.tags.forEach(function(tag) {
                        criterion.filter_data.forEach(function(filter) {
                            if (filter.trim() == tag.trim()) {
                                console.log("Found a post");
                                criterion.posts[key] = post;
                            }
                        });
                    });
                }
                break;
            default:
                break;
        }
    });

    alldir("get_posts", criterion);
    console.log("got_posts_" + criterion.filter + "_" + criterion.filter_data);
    var cbe = function(postse) {
        console.log("posts");
        cb(postse);
    };
    var eventname = "got_posts_" + criterion.filter + "_" + criterion.filter_data;
    when(eventname, cbe);
}

function get_post_by_id(id, cb) {
    if (posts[id]) {
        cb(posts[id]);
    } else {
        alldir("get_posts", {
            filter: "id",
            filter_data: id,
            from: selfId,
            original: selfId,
            count: 1
        });
        whenonce("got_posts_id_" + id, function(post) {
            cb(post.posts);
        })
    }
}

function get_even(criterion, cb) {
    var gotten = 0;
    var posts = {};
    console.log(criterion.count + ": count : " + criterion.count / 2);
    criterion.count = criterion.count / 2;
    get_posts(criterion, function(gposts) {
        gotten++;

        Object.keys(gposts).forEach(function(key) {
            console.log(gposts);
            posts[key] = gposts[key];
        });
        if (gotten >= 1) {
            cb(posts);
            console.log("gotten");
        } else {
            console.log(gotten);
            console.log("not gotten");
        }

    });
}

function isNeighbor(id) {
    var neighbor = false;
    adjacent.forEach(function(adj) {
        if (adj.id === id) {
            neighbor = true;
        }
    })
    return neighbor;
}

function updateUsers() {
    sem.take(function() {
        var usersstring = JSON.stringify(users);
        fs.writeFile('users.json', usersstring, function(err) {
            if (err) {
                console.log("Error creating user");
            } else {
                console.log("Created user successfully");
            }
            sem.leave();
        });
    })
}

function createUser(username, password) {
    var id = hash(username + Date.now());
    bcrypt.hash(password, 10, function(err, hashed) {
        users[id] = {
            id: id,
            date: Date.now(),
            pass: hashed,
            username: username,
            subbed: [],
            tags: {},
            favorites: {}
        }
        updateUsers();
        alldir("update_users", users[id]);
        users[id].original = true;
    });
}

function get_feed(toget, cb) {
    var gotten = 0;
    var need = toget.length
    var posts = {};

    function check() {
        if (gotten >= need) {
            cb(posts);
        }
    }
    toget.forEach(function(get) {
        switch (get.type) {
            case 'tag':
                var pro;
                if (get.pro) {
                    pro = get.pro;
                } else {
                    pro = 1 / toget.length;
                }
                console.log(toget.count + " " + pro);
                var amount = pro * toget.count;
                get_even({
                    count: amount,
                    filter: "tag",
                    filter_data: [get.tag],
                    from: selfId,
                    original: selfId,
                    posts: {}
                }, function(gposts) {
                    gotten++;
                    Object.keys(gposts.posts).forEach(function(key) {
                        console.log(key);

                        posts[key] = gposts.posts[key];
                    });
                    check();
                });
                break
            default:
                break;
        }
    });
}

function follow_tag(req, ifself) {
    console.log(req.uid);
    if (users[req.uid]) {
        console.log("have user");
        if (users[req.uid].original == true) {
            console.log("verifying");
            jwt.verify(req.token, secret, function(err, decode) {
                if (err) {

                    console.log(err);
                } else {
                    if (decode.uid == req.uid) {
                        console.log("updating");
                        users[req.uid].tags[req.tag] = true;
                        updateUsers();
                        alldir("update_users", users[req.uid]);
                        if (ifself) {
                            io.sockets.emit("followed_tag_" + req.uid + "_" + req.tag, users[req.uid]);
                        } else {
                            onedir("followed_tag_" + req.uid + "_" + req.tag, users[req.uid], flip(getDir(req.from)));
                        }
                    } else {
                        console.log("Fradulent request recieved!");
                    }
                }
            });
        }
    } else if (ifself) {
        alldir("follow_tag", req);
    } else {
        passAlong("follow_tag", req);

    }
}

function add_favorite(req, ifself) {
    if (users[req.uid]) {
        console.log("have user");
        if (users[req.uid].original == true) {
            console.log("verifying");
            jwt.verify(req.token, secret, function(err, decode) {
                if (err) {

                    console.log(err);
                } else {
                    if (decode.uid == req.uid) {
                        users[req.uid].favorites[req.pid] = true;
                        updateUsers();
                        alldir("update_users", users[req.uid]);
                        if (ifself) {
                            io.sockets.emit("added_favorite_" + req.uid + "_" + req.pid, users[req.uid]);
                        } else {
                            onedir("added_favorite_" + req.uid + "_" + req.pid, users[req.uid], flip(getDir(req.from)));
                        }

                    }
                }
            })
        }
    } else if (ifself) {
        alldir("add_favorite", req);
    } else {
        passAlong("add_favorite", req);

    }

}

var socket = io.sockets;
console.log(socket);
if (process.argv[2] == "1") {
    setTimeout(function() {
        // createUser("nicohman", "dude");
    }, 10000);
}
if (process.argv[2] == "3") {
    console.log("timeout");
    setTimeout(function() {
        console.log("activate");
        var users = require("./users.json");
        get_user(Object.keys(users)[0], function(user) {
            console.log("Retrieved user: " + user.username);
        });
        createPost({
            title: "First post, bitches",
            auth: "nico",
            tags: ["first", "post"],
            content: "This is the first post"
        });
    }, 1100)
}
if (process.argv[2] == "3") {
    setTimeout(function() {
        console.log("get post");
        get_posts({
            filter: "tag",
            count: 10,
            filter_data: ["first"],
            original: selfId,
            from: selfId,
            posts: []
        }, function(posts) {
            console.log(posts);
        });
    }, 1000);
}
console.log("co");
var serv_handles = {
    "update_users": function(u) {
        if (!users[u.id]) {
            users[u.id] = u;
            updateUsers();
        }
    },
    "update_posts": function(post) {
        if (!posts[post.id]) {
            posts[post.id] = post;
            updatePosts();
        }
    },
    "get_user": function(id) {
        if (users[id.uid]) {
            onedir('got_user_' + uid, id, flip(getDir(id.id)));
        } else {
            id.from = selfId;
            passAlong('get_user', id);
        }
    },
    "check_login": function(u) {
        if (users[u.uid]) {
            bcrypt.compare(u.pwd, users[u.pass], function(err, res) {
                if (res) {
                    onedir("check_result_" + u.uid, {
                        user: u.uid,
                        name: users[u.uid].username,
                        result: res
                    }, getDir(u.from));
                }
            });
        } else {
            passAlong("check_login");
        }
    },
    "add_comment": function(comment) {
        if (posts[comment.id]) {
            posts[comment.id].comments.push(comment);
            updatePosts();
        } else {
            passAlong(comment);
        }
    },
    "add_reg": function(toAdd) {
        //console.log("recieve add");
        if (!reg[reg.id]) {
            reg[toAdd.id] = {
                name: toAdd.name,
                ip: toAdd.ip,
                id: toAdd.id
            };
            console.log("Added to registry " + toAdd.name);
        } else {
            console.log(name + " already in registry");
        }
        toAdd.from = toAdd.recentFrom;
        toAdd.recentFrom = selfId;
        passAlong("add_reg", toAdd);

    },
    "get_reg": function(info) {
        socket.emit("got_reg_" + info.from, reg);

    },
    "get_posts": function(criterion) {
        console.log("Request for posts");
        Object.keys(posts).forEach(function(key) {
            var post = posts[key]
            switch (criterion.filter) {
                case 'tag':
                    console.log("tags");
                    if (Object.keys(criterion.posts).length < criterion.count) {
                        console.log("not enough");
                        post.tags.forEach(function(tag) {
                            criterion.filter_data.forEach(function(filter) {
                                if (filter.trim() == tag.trim()) {

                                    console.log("Found a post");
                                    criterion.posts[key] = post;
                                }
                            });
                        });
                    } else {
                        console.log(Object.keys(criterion.posts).length + " " + criterion.count);
                    }
                    break;
                default:
                    break;
            }
        });
        if (criterion.filter == "id") {
            console.log("id");
            if (Object.keys(criterion.posts).length < criterion.count) {
                if (posts[criterion.filter_data]) {
                    console.log("I d found a post");
                    criterion.posts[criterion.filter_data] = posts[criterion.filter_data];
                }
            }
        }
        if (Object.keys(criterion.posts).length < criterion.count && adjacent[flip(getDir(criterion.from))]) {
            console.log("Passing along");
            passAlong("get_posts", criterion);
        } else {
            console.log("Finishing requests");
            console.log("emitting : got_posts_" + criterion.filter + "_" + criterion.filter_data + "   " + getDir(criterion.from));
            onedir("got_posts_" + criterion.filter + "_" + criterion.filter_data, {
                to: criterion.original,
                filter: criterion.filter,
                posts: criterion.posts,
                filter_data: criterion.filter_data,
                from: selfId,
                original: selfId,
            }, getDir(criterion.from));
        }
    },
    "c_get_posts": function(req) {
        get_posts({
            filter: req.filter,
            count: req.count,
            filter_data: req.data,
            original: selfId,
            from: selfId,
            posts: {}
        }, function(posts) {
            io.to(req.id).emit("c_got_posts_" + req.data, posts);
        });

    },
    "c_get_favorites": function(req) {
	    console.log("got request");
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                get_user(req.uid, function(user) {
                   var favs = Object.keys(user.favorites);
			var got = 0;
			var full = [];
			favs.forEach(function(fav){
				get_post_by_id(fav, function(post){
					full.push(post);
					got++;
					if(got >= favs.length){
						io.to(req.cid).emit("c_got_favorites", full);
					}
				});
			});
                })
            }
        }
    },
    "add_favorite": add_favorite,
    "c_add_favorite": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                add_favorite({
                    from: selfId,
                    original: selfId,
                    uid: req.uid,
                    pid: req.pid,
                    token: req.token

                }, true);
                whenonce("added_favorite_" + req.uid + "_" + req.pid, function(res) {
                    io.to(req.cid).emit("c_added_favorite_" + req.pid, true);
                });
            }
        }
    },
    "c_create_post": function(post) {
        createPost(post);
        io.to(post.cid).emit("c_created_post", true);

    },
    "c_login": function(req) {
        get_user(req.uid, function(user) {
            console.log(user);
            bcrypt.compare(req.password, user.pass, function(err, res) {
                if (res) {
                    console.log("User " + user.username + " successfully logged in");
                    var token = jwt.sign({
                        username: user.username,
                        uid: req.uid
                    }, secret);
                    io.to(req.cid).emit("c_logged_in_" + req.uid, token);
                    logged[req.cid] = req.uid;
                } else {
                    console.log("User " + user.username + " did not successfully log in")
                    io.to(req.cid).emit("c_logged_in_" + req.uid, false);
                }
            });
        });
    },
"c_create_user":function(req){
		if(!logged[req.cid]){
			createUser(req.username, req.password);
			io.to(req.cid).emit("c_created_user");
		}
},
    "c_get_feed": function(req) {
        if (logged[req.cid]) {
            var toget = Object.keys(users[logged[req.cid]].tags).map(function(item) {
                return {
                    type: 'tag',
                    tag: item
                }
            });
            toget.count = 10;
            console.log("getting");
            get_feed(toget, function(posts) {
                console.log(posts);
                console.log("c_got_feed_" + logged[req.cid]);
                io.to(req.cid).emit("c_got_feed_" + logged[req.cid], posts);
            });
        }
    },
    "follow_tag": follow_tag,
    "c_follow_tag": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                follow_tag({
                    from: selfId,
                    original: selfId,
                    uid: req.uid,
                    tag: req.tag,
                    token: req.token

                }, true);
                whenonce("followed_tag_" + req.uid + "_" + req.tag, function(res) {
                    io.to(req.cid).emit("c_followed_tag_" + req.tag, true);
                });
            }
        } else {
            console.log("Not logged in!");
        }
    },
    "c_token_login": function(req) {
        console.log("recieved request");
        var token = req.token
        jwt.verify(token, secret, function(err, decode) {
            if (decode) {
                console.log("worked");
                io.to(req.cid).emit("c_token_logged_in", decode);
                logged[req.cid] = decode.uid
            } else {
                io.to(req.cid).emit("c_token_logged_in", false);
            }
        })
    },
    "create_post": createPost,
    "add_neighbor": function(toAdd) {
        //console.log("from:" + toAdd.from)
        if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId && !adjacent[flip(toAdd.dir)]) {
            adjacent[flip(toAdd.dir)] = {
                id: toAdd.original,
                name: toAdd.name,
                ip: toAdd.ip
            };
            console.log("New neighbor, named " + toAdd.name + " from the direction of " + dirToString(getDir(toAdd.from)));
            console.log("neighbor_add_" + toAdd.original);
            io.emit("neighbor_add_" + toAdd.original, {
                from: selfId,
                name: name,
                condition: "once",
                port: to_open,
                dir: flip(toAdd.dir),
                ip: ip.address()
            });

        } else {
            console.log("Couldn't add " + toAdd.name);
        }

    }
}

io.on('connection', function(gsocket) {

    Object.keys(serv_handles).forEach(function(key) {
        //console.log(key);
        gsocket.on(key, serv_handles[key]);
    });
    gsocket.on("*", function(data) {
        console.log(io.listenerCount(data.data[0]) + ": " + data.data[0]);
        if ((!serv_handles[data.data[0]]) && io.listenerCount(data.data[0]) < 1) {
            console.log("Passing along " + data.data[0]);
            console.log(io.listenerCount(data.data[0]));
            passAlong(data.data[0], data.data[1]);
        } else {

            console.log(io.listenerCount(data.data[0]));
            console.log("handler for : " + data.data[0]);
        }
    });
});

function createClient(to_connect) {
    var client = socketclient(to_connect);
    patch(client);
    var client_handles = {
            "update_users": function(u) {
                if (!users[u.id]) {
                    users[u.id] = u;
                    updateUsers();
                }
            }
        }
        //console.log(to_connect);
    client.on('connect', function() {
        //console.log("connect");
        client.on("*", function(data) {
            //console.log("hillo");
            console.log(data.data[0]);
            if (serv_handles[data.data[0]]) {
                serv_handles[data.data[0]](data.data[1]);
            }
            if (!client_handles[data.data[0]] && client.hasListeners(data.data[0]) < 1) {
                passAlong(data.data[0], data.data[1]);
                console.log("emit");
            }
        });
        var dir;
        if (adjacent.length !== undefined) {
            dir = adjacent.length
        } else {
            dir = 0;
        }
        client.emit("add_neighbor", {
            from: selfId,
            condition: "once",
            name: name,
            dir: dir,
            original: selfId,
            ip: ip.address(),
            port: to_open
        });
        console.log("neighbor_add_" + selfId);
        client.once("neighbor_add_" + selfId, function(toAdd) {
            //console.log("req");
            if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId && !adjacent[flip(toAdd.dir)]) {
                console.log(toAdd.from);
                adjacent[flip(toAdd.dir)] = {

                    id: toAdd.from,
                    name: toAdd.name,
                    ip: toAdd.ip,
                    dir: flip(toAdd.dir),
                    port: toAdd.port
                };
                console.log("New neighbor, named " + toAdd.name + " from the direction of " + dirToString(getDir(toAdd.from)));
            }
        });
        client.emit("add_reg", {
            from: selfId,
            condition: "all",
            name: name,
            id: selfId,
            recentFrom: selfId,
            ip: ip.address()
        });
        client.emit("get_reg", {
            from: selfId,
            condition: "fulfill"
        });
        client.once("got_reg_" + selfId, function(upreg) {
            Object.keys(upreg).forEach(function(key) {
                reg[key] = upreg[key];
            });
            console.log(reg);
        });
    });
    Object.keys(client_handles).forEach(function(key) {
        console.log(key);

        client.on(key, client_handles[key]);
    });
    client.on("disconnect", function() {
        console.log('discoonnect');
    });
    clients.push(client);
    console.log("connected to " + to_connect);
}
