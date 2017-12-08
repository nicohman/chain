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
var name = names[parseInt(process.argv[2])];
console.log("I am the " + name);
var port = ports[parseInt(process.argv[2]) - 1];
console.log(port);
var reg = {};
reg[selfId] = {
    name: name,
    ip: ip.address(),
    id: selfId
};

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
    //console.log(clients);
    if (clients[dir]) {
        clients[dir].emit(eventname, data);
    } else {
        console.log("no hi");
        io.emit(eventname, data);
    }
}

function createPost(post) {
    var id = hash(post.title);
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
        client.on(eventname, function(data) {
            never(eventname);
            cb(data);
        });
    })
    io.on(eventname, function(data) {
        never(eventname);
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
    var cbe = function(posts) {
        console.log("posts");
        cb(posts);
    };
    var eventname = "got_posts_" + criterion.filter + "_" + criterion.filter_data;
    when(eventname, cbe);
    when(eventname, cbe);
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
    var id = hash(username);
    bcrypt.hash(password, 10, function(err, hashed) {
        users[id] = {
            id: id,
            date: Date.now(),
            pass: hashed,
            username: username,
            subbed: []
        }
        updateUsers();
        alldir("update_users", users[id]);
    });
}
var socket = io.sockets;
console.log(socket);
if (process.argv[2] == "1") {
    setTimeout(function() {
        createUser("nicohman", "dude");
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
                    if (Object.keys(criterion.posts).length < criterion.count) {
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
        if (Object.keys(criterion.posts).length < criterion.count && adjacent[flip(getDir(criterion.from))]) {
            console.log("Passing along");
            passAlong("get_posts", criterion);
        } else {
            console.log("Finishing requests");
            console.log("got_posts_" + criterion.filter + "_" + criterion.filter_data);
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
}
