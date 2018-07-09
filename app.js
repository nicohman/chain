//Initialize basic variables and require modules.
var io = require('socket.io'),
    socketclient = require('socket.io-client'),
    ip = require('ip'),
    format = require('biguint-format'),
    FlakeId = require('flake-idgen'),
    bcrypt = require('bcrypt'),
    ports = ["2000", "3000", "4000", "5000", "6000"],
    middleware = require("socketio-wildcard")(),
    patch = require("socketio-wildcard")(socketclient.Manager),
    fs = require("fs"),
    names = ["dragon", "defiant", "dragon's teeth", "saint", "weaver"],
    semaphore = require('semaphore'),
    mongoose = require("mongoose"),
    sem = semaphore(1),
    YouTube = require("youtube-node"),
    yt = new YouTube(),
    DEMPATH = "/home/nicohman/.demenses/",
    san = require("sanitizer"),
    events = require('events'),
    nodemailer = require('nodemailer'),
    selfEmitter = new events.EventEmitter(),
    server = new events.EventEmitter(),
    shahash = require('crypto'),
    commandArg = parseInt(process.argv[2]),
    clients = [],
    selfId = format(new FlakeId({
        datacenter: 1,
        worker: commandArg
    }).next(), "dec"),
    config = require(DEMPATH + "config.json"),
    jwt = require("jsonwebtoken"),
    name = names[commandArg],
    posts = require(DEMPATH + 'posts_' + name + '.json'),
    users = require(DEMPATH + "users_" + name + ".json"),
    deals = require(DEMPATH + "deals.json"),
    port = ports[commandArg - 1],
    ytChannels = ["UUQD3awTLw9i8Xzh85FKsuJA"],
    curations = require(DEMPATH + "curations_" + name + ".json"),
    secret = config.secret,
    emailSecret = config.emailSecret,
    moment = require('moment'),
    reg = {},
    smtpConf = {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        pool: true,
        auth: {
            user: 'nico.hickman@gmail.com',
            pass: config.emailpass
        }
    },
    rec = {},
    logged = {};

mongoose.connect("mongodb://localhost/demenses");
var Post = mongoose.model('Post', {
    id: String,
    title: String,
    auth: String,
    alt: String,
    color: String,
    uid: String,
    date: String,
    tags: Array,
    content: String,
    comments: Array,
    favs: Number
});
var Curation = mongoose.model('Curation', {
    tags: Array,
    rules: Array,
    own: String,
    name: String
});
var User = mongoose.model('User', {
    id: String,
    date: String,
    pass: String,
    username: String,
    subbed: Array,
    curs: Object,
    email: String,
    tags: Object,
    curations_owned: Object,
    favorites: Object
});
var https = require("https");
console.log(config.yt);
yt.setKey(config.yt);
//Startup logs.
console.log(
    "________                                                     \n\\______ \\   ____   _____   ____   ____   ______ ____   ______\n |    |  \\_/ __ \\ /     \\_/ __ \\ /    \\ /  ___// __ \\ /  ___/\n |    `   \\  ___/|  Y Y  \\  ___/|   |  \\___ \\  ___/ \\___ \\ \n/_______  /\\__  >__|_|  /\\___  >___|  /____  >\\___  >____  >\n        \\/     \\/      \\/     \\/     \\/     \\/     \\/     \\/ "
);
console.log("I am the node " + name + ", with an id of " + selfId,
    " at the ip address " + ip.address());
//Provide registry lookup for self.
reg[selfId] = {
    name: name,
    ip: ip.address(),
    id: selfId
};

function fulfill(name, condition, func, auth, amal, easy) {
    var doneFunc = function(req, cb) {
        function others() {
            if (cb) {
                alldir(name, req);
                var done = 0;
                var posts = {};
                var curs = [];
                when(name + req.id, function(res) {
                    done++;
                    switch (amal) {
                        case "once":
                            if (res) {
                                never(name + req.id);
                                cb(res)
                            } else if (done >= 2) {
                                cb(false);
                                console.log("TOO MANY RRES");
                                never(name + req.id);
                            }
                            break;
                        case "posts":
                            if (res) {
                                Object.keys(res.posts).forEach(function(key) {
                                    if (!posts[key]) {
                                        posts[key] = res.posts[key];
                                    }
                                });
                            }
                            if (done >= 2) {
                                cb(posts);
                            }
                            break;
                        case "curs":
                            if (res) {
                                curs = curs.concat(res.curs);
                                curs = curs.sort(cmpcurfavs);
                                curs.splice(0, res.count);
                            }
                            if (done >= 2) {
                                cb(curs);
                            }
                            break;
                        default:
                            console.log("Invalid amal option");
                            never(name + req.id);
                            break;
                    }
                });
            } else if (adjacent[flip(getDir(req.from))]) {
                passAlong(name, req);
            } else {
                console.log("Hit end, going back");
                onedir(name + req.id, false, getDir(req.from));
            }
        }
        if (auth) {
            if (req.token) {
                verify(req.token, function(res) {
                    if (res) {
                        var newreq = req;
                        Object.keys(res).forEach(function(key) {
                            newreq[key] = res[key];
                        });
                        var con = condition(newreq);
                        if (con) {
                            var res = func(newreq, con);
                            if (cb) {
                                cb(res);
                            } else {
                                onedir(name + req.id, res, getDir(req.from));
                            }
                        } else {
                            others();
                        }
                    } else {
                        console.log("BAD TOKEN");
                        if (cb) {
                            cb(false);
                        } else {
                            onedir(name + req.id, false, getDir(req.from));
                        }
                    }
                });
            } else {
                console.log("NO TOKEN");
                if (cb) {
                    cb(false)
                } else {
                    onedir(name + req.id, false, getDir(req.from));
                }
            }
        } else {
            var con = condition(req);
            if (con) {
                var res = func(req, con);
                if (cb) {
                    cb(res);
                } else {
                    onedir(name + req.id, res, getDir(req.from));
                }
            } else {
                others();
            }
        }
    }
    if (easy) {
        doneFunc.easy = function(props, cb) {
            var def = {
                from: selfId,
                original: selfId
            };
            Object.keys(props).forEach(function(key) {
                def[key] = props[key];
            });
            def.id = hash(Date.now() + selfId + name);
            doneFunc(def, cb);
        };
    }
    return doneFunc;
}
var time = moment(fs.readFileSync("/home/nicohman/.demenses/timer"), 'x');
var lastYts = require("/home/nicohman/.demenses/lastyts.json");
var lastX = fs.readFileSync("/home/nicohman/.demenses/lastX");
if (!lastYts) {
    lastYts = {};
}

function writeLast() {
    fs.writeFile("/home/nicohman/.demenses/lastyts.json", JSON.stringify(lastYts),
        function() {})
}

function checkYt() {
    ytChannels.forEach(function(item) {
        yt.setKey(config.yt);
        console.log("KEY : " + config.yt);
        yt.getPlayListsItemsById(item, function(err, res) {
            if (err) {
                console.error(err);
            } else {
                if (res.items) {
                    if (res.items[0]) {
                        console.log(res.items[0]);
                        var uid = "johnnyfiveisalive"
                        var vid = res.items[0].snippet;
                        if (!lastYts[item]) {
                            lastYts[item] = "";
                        }
                        if (vid.resourceId.videoId.trim() != lastYts[item].trim()) {
                            createPost({
                                title: vid.title,
                                content: "https://youtube.com/watch?v=" + vid.resourceId.videoId,
                                auth: "yt_bot",
                                uid: uid,
                                tags: ["yt_bot", "bot", "videos"]
                            });
                            lastYts[item] = vid.resourceId.videoId;
                            writeLast();
                        } else {
                            console.log("NO NEW VIDEO FOR " + item)
                            console.log(vid.resourceId.videoId.trim() + "," + lastYts[item].trim());
                        }
                    }
                }
            }
        });
    });
}

function verify(token, cb) {
    jwt.verify(token, secret, function(err, decode) {
        if (err) {
            cb(false);
        } else {
            cb(decode);
        }
    });
}

function checkX() {
    try {
        var req = https.get("https://xkcd.com/info.0.json", function(res) {
            var data = '';
            res.on('data', function(bit) {
                data += bit;
            });
            res.on("error", function(err) {
                console.error(err);
                data = {};
            });
            res.on('end', function() {
                console.log(data);
                data = JSON.parse(data);
                if (data) {
                    if (data.num > parseInt(lastX)) {
                        var uid = "johnnyfiveisalive"
                        createPost({
                            title: "XKCD #" + data.num + " " + data.title,
                            content: data.img,
                            auth: "xkcd_bot",
                            uid: uid,
                            alt: data.alt,
                            tags: ["xkcd", "bot", "comics"]
                        });
                        lastX = data.num;
                        fs.writeFile("/home/nicohman/.demenses/lastX", data.num, function() {
                            console.log("XKCD Last updated!");
                        });
                    } else {
                        console.log("NO XKCD")
                        console.log(data.num + "" + lastX);
                    }
                }
            })
        });
        req.on('error', function(e) {
            console.error(e);
        });
    } catch (e) {
        console.error(e);
    }
}
var checkGames = function() {
    var req = https.get(
        "https://www.reddit.com/r/GameDeals/hot/.json?count=1&limit=1",
        function(res) {
            var data = "";
            res.on("data", function(bit) {
                data += bit;
            });
            res.on("end", function() {
                data = JSON.parse(data);
                var uid = "domoarigato";
                var post = data.data.children[0].data;
                if (post.title.toLowerCase().indexOf("(free)") != -1) {
                    if (!deals[post.url]) {
                        createPost({
                            title: post.title.replace("(Free)", ""),
                            content: post.url,
                            auth: "gamedeals_free_bot",
                            uid: uid,
                            tags: ["gamedeals", "free_games", "bot"]
                        });
                        deals[post.url] = true;
                        fs.writeFile("/home/nicohman/.demenses/deals.json", JSON.stringify(
                            deals), function() {
                            console.log("Wrote updated deals");
                        })
                    }
                } else {
                    console.log("Not free");
                }
            });
        });
    req.on('error', function(e) {
        console.error(e);
    });
}
var checkMe = function() {
    if (time.isBefore(moment(), 'day')) {
        console.log("A day has passed!");
        time = moment();
        fs.writeFile("/home/nicohman/.demenses/timer", time.valueOf(), "utf-8",
            function() {
                var req = https.get(
                    "https://www.reddit.com/r/me_irl/top/.json?count=1&limit=1",
                    function(res) {
                        var data = "";
                        res.on("data", function(bit) {
                            data += bit;
                        });
                        res.on('end', function() {
                            var uid = "klaatubaradanikto"
                            data = JSON.parse(data);
                            var post = data.data.children[0].data;
                            var id = createPost({
                                title: post.title,
                                content: post.url,
                                auth: "me_irl_bot",
                                uid: uid,
                                tags: ["me_irl", "bot", "memes"]
                            });
                            addComment({
                                uid: uid,
                                auth: "me_irl_bot",
                                content: "Post made by " + post.author + " on /r/me_irl",
                                id: id
                            });
                        });
                    });
                req.on('error', function(e) {
                    console.error(e);
                });
            });
    } else {
        console.log("A day has not passed. " + time.toNow(true));
    }
}
var follow_cur = new fulfill("follow_cur", function(req) {
    return true;
}, function(req) {
    favsCur.easy({
        cid: req.cur,
        num: 1
    }, function() {});
    User.find({
        id: req.uid
    }, function(err, u) {
        u.curs[req.cur] = true;
        u.save();
    })
    return true;
}, true, "once", true);
//Lets a user follow a curation. Event function.
//Set up nodemailer.
var transporter = nodemailer.createTransport(smtpConf);
transporter.verify(function(err) {
    if (err) {
        console.error(err);
        process.exit(0);
    }
});

//Generates a Password reset link based on an user's email.
function genRecLink(email, cb) {
    easyEmail({
        email: email
    }, function(u) {
        if (u) {
            var token = jwt.sign({
                uid: u.id,
                email: email
            }, emailSecret, {
                expiresIn: 2700
            });
            var link = "https://demenses.net/reset/" + token;
            cb(link);
        } else {
            cb(false);
        }
    });
}
//Sends a password reset email.
function sendRecEmail(email, cb) {
    genRecLink(email, function(link) {
        if (link) {
            transporter.sendMail({
                from: 'demenses@demenses.net',
                to: email,
                subject: 'Recovery link for your Demenses account',
                text: 'Please use this link to reset your password: ' + link,
                html: '<p>Please use <a href="' + link +
                    '">this</a> link to reset your password.</p>'
            }, function(err) {
                if (err) {
                    cb(false);
                } else {
                    cb(true);
                }
            });
        }
    });
}
//Generic hash function, for unique ids where needed.
function hash(data) {
    return shahash.createHash('sha1').update(data, 'utf-8').digest('hex');
}
//Temporary code while I'm keeping all the nodes on one machine that lets them connect to each other.
var sslopts = {
    key: fs.readFileSync("/etc/letsencrypt/live/demenses.net/privkey.pem"),
    cert: fs.readFileSync("/etc/letsencrypt/live/demenses.net/fullchain.pem"),
};
//Setup socketio server connection.
var to_open = ports[commandArg];
var htt = https.Server(sslopts);
io = io(htt);
console.log("OPENING " + to_open);
htt.listen(to_open);
io.use(middleware);
var adjacent = [];
if (port == undefined) {
    port = "1000";
    console.log("First!" + port + to_open);
}
var to_connect = 'https://demenses.net:' + port;
console.log("TOCONNECT" + to_connect);
setTimeout(function() {
    createClient(to_connect);
}, 1500);
//Takes a link id and finds which direction[1-0] it is connected in.
function getDir(id) {
    var index = -1;
    adjacent.forEach(function(newid, newindex) {
        if (newid.id === id) {
            index = newindex;
        }
    });
    return index;
}
//Shortcut to get a user by uid.
function get_user(uid, cb) {
    User.findOne({
        id: uid
    }, function(err, u) {
        if (!err && u) {
            cb(u);
        }
    })
}
var emails = {}

async function search_email(email) {
    var prom = User.find({
        email: email
    });
    var res = await prom.exec();
    if (res) {
        return res;
    } else {
        return false;
    }
}
var get_user_by_email = new fulfill("find_user_by_email", function(req) {
    return true;
}, function(req) {
    console.log("Found");

    return search_email(req.email)
}, false, "once", true);
var easyEmail = get_user_by_email.easy;
//Get a user by email.
var change_pass = new fulfill("change_pass", function(req) {
    return true
}, function(req, u) {
    bcrypt.hash(req.pass, 10, function(err, hashed) {
    	var u = search_email(req.email);
    	u.pass = hashed;
    	u.save();
    });
}, true, "once", true);
//Does exactly what it says on the tin. Used to reverse an event's direction.
function flip(dir) {
    var ret = -1;
    switch (dir) {
        case 0:
            ret = 1;
            break;
        case 1:
            ret = 0;
            break;
    }
    return ret;
}
//Passes given event along chain.
function passAlong(eventname, data) {
    var from = flip(getDir(data.from));
    data.from = selfId;
    onedir(eventname, data, from);
}
//Sends an event in all directions down the chain.
function alldir(eventname, data) {
    console.log(reg);
    clients.forEach(function(client) {
        console.log("emitting");
        client.emit(eventname, data);
    });
    io.emit(eventname, data);
}
//Sends event in one direction down chain.
function onedir(eventname, data, dir) {
    if (clients[dir]) {
        clients[dir].emit(eventname, data);
    } else {
        io.emit(eventname, data);
    }
}
//Creates a post, writes to disk and mirrors it to adjacent links.
function createPost(post) {
    var id = hash(post.title + post.auth + Date.now());
    console.log("post");
    var auth = post.auth;
    var color = false;
    User.findOne({
        id: post.uid
    }, function(err, u) {
        if (!err) {
            if (u.color) {
                color = u.color

            }

            pO = {
                id: id,
                title: san.escape(post.title),
                auth: auth,
                alt: post.alt,
                color: color,
                uid: post.uid,
                date: Date.now(),
                tags: post.tags.map(san.escape).map(function(t) {
                    t.toLowerCase()
                }),
                content: san.escape(post.content),
                comments: [],
                favs: 0
            }
            var npost = new Post(pO);
            npost.save();
        }
    })

    return id;
}
//Writes curations to disk.
function updateCurs(cur) {
    sem.take(function() {
        var curstring = JSON.stringify(curations);
        fs.writeFile(DEMPATH + "curations_" + name + ".json", curstring, function(
            err) {
            if (err) {
                console.log("Error updating curations");
            }
            curations = require(DEMPATH + "curations_" + name + ".json");
            sem.leave();
        });
    });
    if (cur) {
        alldir("update_curs", cur);
    }
}
//Writes posts to disk.
function updatePosts(post) {
    sem.take(function() {
        Object.keys(posts).forEach(function(key) {
            if (posts[key].favorited == true) {
                posts[key].favorited = undefined;
            }
        });
        var usersstring = JSON.stringify(posts);
        fs.writeFile(DEMPATH + 'posts_' + name + '.json', usersstring, function(
            err) {
            if (err) {
                console.log("Error creating posts");
            } else {
                console.log("Created post successfully");
            }
            posts = require(DEMPATH + "posts_" + name + ".json");
            sem.leave();
        });
    })
    if (post) {
        alldir("update_posts", post);
    }
}
//Adds a comment.
function addComment(comment) {
    Post.findOne({
        id: comment.postid
    }, function(err, post) {
        if (!err) {
            post.comments.push(comment);
            post.save();
        }
    });
}
//When given a number-based id, returns a human-readable string.
function dirToString(dir) {
    var ret = "neither";
    switch (dir) {
        case -1:
            ret = "neither"
            break;
        case 0:
            ret = "left"
            break;
        case 1:
            ret = "right"
            break;
    }
    return ret;
}
//Sets listener everywhere.
function when(eventname, cb) {
    clients.forEach(function(client) {
        console.log("whenening");
        client.on(eventname, function(data) {
            //never(eventname);
            console.log("whened from client" + eventname + getDir(data.from));
            cb(data);
        });
    })
    io.on(eventname, function(data) {
        console.log("whened from server" + eventname + getDir(data.from));
        console.log(getDir(data.from));
        // never(eventname);
        cb(data)
    });
    server.on(eventname, cb);
}
//Sets listener everywere once.
function whenonce(eventname, cb) {
    clients.forEach(function(client) {
        console.log("whenening");
        client.once(eventname, function(data) {
            never(eventname);
            console.log("whened " + eventname + getDir(data.from));
            cb(data);
        });
    })
    io.once(eventname, function(data) {
        console.log("whened" + eventname + getDir(data.from));
        console.log(getDir(data.from));
        never(eventname);
        cb(data)
    });
    selfEmitter.once(eventname, function(data) {
        console.log("whened" + eventname + getDir(data.from));
        cb(data)
    });
}
//Unsets listener everywhere.
function never(eventname) {
    clients.forEach(function(client) {
        client.removeAllListeners(eventname);
    });
    io.removeAllListeners(eventname);
}
//Compares favorite numbers of two posts. Intended for use with Array.sort().
/*
function cmpfavs(post1, post2) {
	var a2bo = 0;
	var a1bo = 0;
	if (post1.stickied) {
		a1bo += 2000;
	}
	if (post2.stickied) {
		a2bo += 2000;
	}
	if (post1.favs + a1bo < post2.favs + a2bo) {
		return 1;
	} else if (post1.favs + a1bo > post2.favs + a2bo) {
		return -1;
	} else {
		return 0;
	}
}*/
function cmpfavsD(post1, post2) {
    var a2bo = 0;
    var a1bo = 0;
    if (post1.stickied) {
        a1bo += 2000;
    }
    if (post2.stickied) {
        a2bo += 2000;
    }
    var p1d = moment(post1.date);
    var p2d = moment(post2.date);
    var now = moment();
    a1bo += p1d.diff(now, 'days');
    a2bo += p2d.diff(now, 'days');
    if (post1.favs + a1bo < post2.favs + a2bo) {
        return 1;
    } else if (post1.favs + a1bo > post2.favs + a2bo) {
        return -1;
    } else {
        return 0;
    }
}
//Checks a post against a given set of curation rules to see whether it is allowed in.
function checkRules(post, rules) {
    var ok = true;
    if (rules) {
        Object.keys(rules).forEach(function(key) {
            var rule = rules[key];
            switch (rule.type) {
                case "not_u":
                    if (post.uid == rule.value) {
                        ok = false;
                    }
                    break;
                case "no_string":
                    if (post.content.indexOf(rule.value) !== -1) {
                        ok = false;
                    }
                    break;
            }
        });
    }
    if (ok) {
        return true;
    } else {
        return false;
    }
}

function postDate(post1, post2) {
    post1 = posts[post1];
    post2 = posts[post2];
    if (post1.date > post2.date) {
        return -1;
    } else if (post2.date > post1.date) {
        return 1;
    } else {
        return 0;
    }
}
//Get posts event function.
function get_posts(criterion, cb) {
    //	var search;
    switch (criterion.filter) {
        case 'tag':
            search = Post.find({
                tags: {
                    $in: criterion.filter_data
                }
            }, null, {
                limit: criterion.count
            });
            break;
        case 'user':
            search = Post.find({
                uid: criterion.filter_data.trim()
            }, null, {
                limit: criterion.count
            });
            break;
        case 'string':
            search = Post.find({
                $text: {
                    $search: criterion.filter_data.trim()
                }
            }, null, {
                limit: criterion.count
            });
            break;
        case 'id':
            search = Post.find({
                id: criterion.filter_data
            });
            break;
        case 'favs':
            search = Post.find({}, null, {
                sort: {
                    favs: -1
                },
                limit: criterion.count
            });
            break;
        default:
            search = Post.find({}, null, {
                sort: {
                    favs: -1
                },
                limit: criterion.count
            });
            break;
    }
    console.log(criterion.filter);
    console.log(search);
    search.exec(function(err, p) {
        criterion.posts = p;
        Object.keys(p).forEach(function(pk) {
            criterion.posts[p[pk].id] = p[pk];
        });
        console.log("CRITPOSTS");
        console.log(criterion.posts);
        cb(criterion);
    });
}
//Get a post by id easily.
function get_post_by_id(id, cb) {
    Post.findOne({
        id: id
    }, function(req, p) {
        cb(p);
    })
}
//Gets an even amount of posts from both directions.
function get_even(criterion, cb) {
    var gotten = 0;
    var posts = {};
    criterion.count = criterion.count / 2;
    get_posts(criterion, function(gposts) {
        gotten++;
        Object.keys(gposts).forEach(function(key) {
            posts[key] = gposts[key];
        });
        if (gotten >= 1) {
            if (criterion.filter == "favs") {
                var fin = {};
                //console.log(posts);
                posts.posts.forEach(function(post) {
                    fin[post.id] = post;
                });
                //console.log(fin);
                fin = Object.keys(fin).map(function(p) {
                    return fin[p];
                }).sort(cmpfavsD);
                posts.posts = fin;
            }
            //console.log(posts.posts);
            cb(posts);
            posts = {}
            console.log("gotten");
        } else {
            console.log(gotten);
            console.log("not gotten");
        }
    });
}
//Gets all posts of a user.
function getPostsByUser(uid, cb, count) {
    if (!count) {
        count = 50;
    }
    get_even({
        filter: "user",
        count: count,
        filter_data: uid,
        from: selfId,
        original: selfId,
        posts: {}
    }, function(posts) {
        cb(posts);
    });
}
//Checks if a given link id is a neighbor.
function isNeighbor(id) {
    var neighbor = false;
    adjacent.forEach(function(adj) {
        if (adj.id === id) {
            neighbor = true;
        }
    })
    return neighbor;
}
//Writes users to disk.
function updateUsers(u) {
    if (u) {
        alldir("update_users", u);
    }
    sem.take(function() {
        var usersstring = JSON.stringify(users);
        fs.writeFile(DEMPATH + 'users_' + name + '.json', usersstring, function(
            err) {
            if (err) {
                console.log("Error creating user");
            } else {
                console.log("Created user successfully");
            }
            console.log("leaving! from " + name);
            sem.leave();
        });
    })
}
//Creates a user.
function createUser(username, password, email, cb) {
    var id = hash(username + Date.now());
    bcrypt.hash(password, 10, function(err, hashed) {
    	var nu = new User({
            id: id,
            date: Date.now(),
            pass: hashed,
            username: san.escape(username),
            subbed: [],
            curs: {},
            email: san.escape(email),
            tags: {},
            curations_owned: {},
            favorites: {}
        });
        nu.save();
        cb(id);
    });
}
//Gets all posts based on an array of rules/needs.
function get_feed(toget, cb) {
    var gotten = 0
    var got = {};
    var need = toget.length;
    var posts = {};
    var called = false;
    console.log("NEED:");
    console.log(toget);

    function check() {
        console.log("MIDAY:" + Object.keys(got).length + ":" + need);
        if (Object.keys(got).length >= need /* && !called*/ ) {
            console.log("Calling to get feed." + gotten + need);
            console.log(posts);
            cb(posts);
            called = true;

        } else {
            console.log("NOT READY");
            console.log(got);
            console.log(need);
        }
        if (called) {
            console.log("called already!");
        }
    }
    toget.forEach(function(get) {
        console.log(get);
        switch (get.type) {
            case 'tag':
                var pro;
                if (get.pro) {
                    pro = get.pro;
                } else {
                    pro = 1 / toget.length;
                }
                var amount = pro * toget.count;
                console.log(amount + ":amount");
                get_even({
                    count: amount,
                    filter: "tag",
                    filter_data: [get.tag],
                    from: selfId,
                    original: selfId,
                    posts: {}
                }, function(gposts) {
                    console.log("respost " + gotten);
                    got[get.tag + "_tag"] = true;
                    Object.keys(gposts.posts).forEach(function(key) {
                        console.log("I GOT ONE" + key)
                        posts[key] = gposts.posts[key];
                    });
                    check();
                });
                break
            case "cur":
                var pro;
                if (get.pro) {
                    pro = get.pro;
                } else {
                    pro = 1 / toget.length;
                }
                var amount = pro * toget.count;
                console.log(amount + ":amount");
                get_curation_posts(get.cur, function(gposts) {
                    console.log("GOT CURATUION PSOTS");
                    Object.keys(gposts).forEach(function(key) {
                        posts[key] = gposts[key];
                    });
                    console.log(posts);
                    console.log("THOSE WERE C POSTS");
                    got[get.cur + "_cur"] = true;
                    console.log(got);
                    check();
                }, amount);
                break;
            default:
                break;
        }
    });
}
//Lets a user follow a tag. Event function.
var follow_tag = new fulfill("follow_tag", function(req) {

    return true;
}, function(req) {
	User.findOne({req.uid}, function(err, u){
		u.tags[req.tag] = true;
		u.save();
	})
    return true;
}, true, "once", true);
//Lets a user unfollow a curation. Event function.
var unfollow_cur = new fulfill("unfollow_cur", function(req) {
    return true;
}, function(req) {
    favsCur.easy({
        num: -1,
        cid: req.cur
    }, function() {})
    User.find({id:req.uid}, function(err, u){
    	if(!err){
    		u.curs[req.cur] = true;
    	}
    })
    return true;
}, true, "once", true);
var unfollow = new fulfill("unfollow", function(req) {
    if (users[req.uid]) {
        return users[req.uid].original
    }
    return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.tags[req.tag] = false;
		u.save();
	});
    return true;
}, true, "once", true);
//Lets a user unfollow a tag. Event function.
//Lets a user favorite a post.
var add_favorite = new fulfill("add_favorite", function(req) {
    return true
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.favorites[req.pid] = true;
		u.save();
	})
    favsUpdate.easy({
        pid: req.pid,
        num: 1
    }, function() {});
    return true;
}, true, "once", true);
var favsUpdate = new fulfill("update_favs", function(req) {
    return true;
}, function(req) {
    Post.findOne({
        id: req.pid
    }, function(err, p) {
        p.favs += req.num;
        p.save();
    });
    return true;
}, false, "once", true);
var delete_curation = new fulfill("delete_curation", function(req) {
    if (curations[req.cur]) {
        return true;
    } else {
        return false;
    }
}, function(req) {
    if (req.uid == curations[req.cur].own) {
        delete curations[req.cur];
        take_cur_own({
            cid: req.cur,
            token: req.token
        }, function() {});
        updateCurs(curations[req.cur]);
        return true;
    } else {
        return false;
    }
}, true, "once", true);
var delete_comment = new fulfill("delete_comment", function(req) {
    return true;
}, function(req) {
    Post.find({
        id: req.pid
    }, function(err, p) {
        delete p.comments[req.cpos];
        p.save();
    })
    return true;
}, true, "once", true);
var favsCur = new fulfill("update_cur_favs", function(req) {
    return curations[req.cid]
}, function(req) {
    if (!curations[req.cid].favs) {
        curations[req.cid].favs = 0;
    }
    curations[req.cid].favs += req.num;
    updateCurs(curations[req.cid]);
    if (req.original == selfId) {
        alldir("update_cur_favs", req);
    }
    return true;
}, false, "once", true);
//Delete post event function. Requires either author's jwt token or admin status.
function deletePost(req, cb) {
    Post.findOne({
        id: req.pid
    }, function(err, p) {
        if (!err) {
            jwt.verify(req.token, secret, function(err, decode) {
                if (!err) {
                    if (decode.uid == p.uid || decode.admin === true) {
                        Post.deleteOne({
                            id: req.pid
                        }, function() {
                            req.deleted++;
                            cb(req);
                        });
                    } else {
                        cb(false);
                    }
                } else {
                    cb(false)
                }
            });
        }
    });
}
// Easy way to delete a post given a token and pid.
function easyDel(pid, token, cb) {
    deletePost({
        from: selfId,
        original: selfId,
        pid: pid,
        token: token,
        deleted: 0
    }, function(res) {
        console.log("DELETED POST");
        cb(res);
    });
}
//Iterates through posts, adding favorited to them where they match favs.
function checkFavs(favs, rposts) {
    var fposts = rposts;
    if (rposts.posts) {
        fposts = rposts.posts;
    }
    Object.keys(favs).forEach(function(fav) {
        if (favs[fav] === true) {
            if (fposts[fav]) {
                fposts[fav].favorited = true;
            } else {

                console.log(fposts);
                console.log("POST NOT HERE")
            }
        } else {
            console.log("NOT TRUE");
        }
    });
    return fposts;
}
//Same as checkFavs, but for when posts are in an array.
function checkFavsArr(favs, rposts) {
    rposts.forEach(function(post, index) {
        if (favs[post.id] === true) {
            rposts[index].favorited = true;
        }
    });
    return rposts
}
//Change username event function
var change_username = new fulfill("change_username", function(req) {
            return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.username = req.new_u;
		u.save();
	})
    return true;
}, true, "once", true);
var changeEmail = new fulfill("change_email", function(req) {
    return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.email = req.email;
		u.save();
	})
    return true;
}, true, "once", true);
var change_color = new fulfill("change_color", function(req) {
    var u = search_email(req.Temail);
    if (u) {
        console.log("Found user with the email " + req.Temail);
        return u.original;
    }
    return false;
}, function(req) {
    var id = search_email(req.Temail).id;
    console.log("CHANGE");
    User.find({
        id: id
    }, function(err, r) {
        r.color = req.color;
        r.save();
    });
    return true;
}, true, "once", true);
var unfavorite = new fulfill("unfavorite", function(req) {
    return true
}, function(req) {
    User.find({
        id: req.uid
    }, function(err, r) {
        r.favorites[req.pid] = false;
        r.save();
        favsUpdate.easy({
            pid: req.pid,
            num: -1
        }, function() {});

    });

    return true;
}, true, "once", true);
var add_notif = new fulfill("add_notif", function(req) {
    return true;
}, function(req) {
    console.log("notif");
    var id = hash(req.notif.title + req.notif.content + req.Tuid);
    User.find({
        id: req.Tuid
    }, function(err, r) {

        if (r.notifs) {
            r.notifs[id] = req.notif
        } else {
            r.notifs = {}
            r.notifs[id] = req.notif;
        }
        r.notifs[id].id = id;
        r.save();
    });
    return true;
}, true, "once", true);
var rm_notif = new fulfill("rm_notif", function(req) {
    return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		if(u.notifs){
			delete u.notifs[req.nid];
		}
		u.save();
	})
    return true;
}, true, "once", true);
var get_notifs = new fulfill("get_notifs", function(req) {
    return true;
}, async function(req) {
	var u = await User.findOne({id:req.uid}).exec();
    if (u.notifs) {
        return u.notifs;
    } else {
        u.notifs = {};
        u.save();
        return {}
    }
}, true, "once", true);
var add_comment = new fulfill("add_comment", function(req) {
    return true;
}, function(req) {
    Post.findOne({
        id: req.pid
    }, function(err, p) {
        p.comments.push(req);
        p.save();
        console.log("Added comment");

    })
    return true;
}, false, "once", true);
var sticky = new fulfill("sticky", function(req) {
    return true;
}, function(req) {
    if (req.admin) {
        Post.findOne({
            id: req.pid
        }, function(p) {
            p.stickied = true;
            p.save();
        })
        return true;
    }
    return false;
}, true, "once", true);
var unsticky = new fulfill("unsticky", function(req) {
    return true;
}, function(req) {
    if (req.admin) {
        Post.findOne({
            id: req.pid
        }, function(p) {
            p.stickied = false;
            p.save();
        })
        return true;
    }
    return false;

}, true, "once", true);
/*function getCurationById(id, cb) {
	if (curations[id]) {
		cb(curations[id]);
	} else {
		alldir("get_curation", {
			from: selfId,
			original: selfId,
			id: id
		});
		when("got_curation_" + id, function(cur) {
			cb(cur);
		});
	}
}*/
function get_curation_by_name(name, cb) {
    get_curation({
        filter: "name",
        filter_data: name
    }, function(res) {
        cb(res);
    });
}
var add_cur_own = new fulfill("add_cur_own", function(req) {
    return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.curations_owned[req.cid] = true;
		u.save();
	})
    return true;
}, true, "once", true);
var take_cur_own = new fulfill("take_cur_own", function(req) {
    return true;
}, function(req) {
	User.findOne({id:req.uid}, function(err, u){
		u.curations_owned[req.cid] = false;
		u.save();
	})
    return true;
}, true, "once", true);
var get_curation = function(req, cb) {
    if (req.filter == "name") {
        Curation.findOne({
            name: req.filter_data
        }, function(err, p) {
            cb(p)
        });
    }
}

function create_curation(req, cb) {
    jwt.verify(req.token, secret, function(err, decode) {
        if (decode.uid == req.uid) {
            curations[req.title] = {
                tags: req.tags,
                rules: {},
                own: req.uid,
                name: req.title
            }
            updateCurs(curations[req.title]);
            cb(true);
        }
    });
}

function cmpcurfavs(cur1, cur2) {
    if (curations[cur1].favs && curations[cur2].favs) {
        if (curations[cur1].favs > curations[cur2].favs) {
            return -1;
        } else if (curations[cur1].favs < curations[cur2].favs) {
            return 1;
        } else {
            return 0;
        }
    } else {
        if (curations[cur1].favs) {
            return -1;
        } else if (curations[cur2].favs) {
            return 1;
        } else {
            return 0;
        }
    }
}
var get_curs_top = new fulfill("get_curs_top", function(req) {
    req.curs = req.curs.concat(Object.keys(curations).sort(cmpcurfavs).splice(0,
        req.count));
    req.curs = req.curs.sort(cmpcurfavs).filter(function(elem, index, self) {
        return index === self.indexOf(elem);
    }).splice(0, req.count);
    return !adjacent[flip(getDir(req.from))];
}, function(req) {
    return req;
}, false, "curs", true, {
    curs: []
});

function updateRec(id) {
    Object.keys(rec[id]).forEach(function(key) {
        if (!moment(rec[id][key]).isAfter(moment().subtract(1, 'days'))) {
            delete rec[id][key]
        }
    });
}
var ban = new fulfill(function(req) {
	return true;
}, function(req) {
    if (req.admin) {
    	User.findOne({id:req.uid}, function(err, u){
    		u.banned = true;
    		u.save();
    	})
        return true;
    }
    return false;
}, true, "once", true);
var unban = new fulfill(function(req) {
    return true
}, function(req) {
    if (req.admin) {
    	User.findOne({id:req.uid}, function(err, u){
    		u.banned = false;
    		u.save();
    	})
        return true;
    }
    return false;
}, true, "once", true);

function get_curation_posts(cur, cb, count) {
    if (!count) {
        count = 10;
    }
    var got = 0
    var called = false;
    var posts = {};
    var got = {};
    get_curation_by_name(cur, function(cur) {
        if (cur) {
            var need = cur.tags.length
            var rec = function(name) {
                return function(gotposts) {
                    if (gotposts.posts) {
                        console.log("GET EVEN CALLED")
                        gotposts = gotposts.posts;
                        Object.keys(gotposts).forEach(function(key) {
                            posts[key] = gotposts[key];
                        });
                        got[name] = true;
                        if (Object.keys(got).length >= need && !called) {
                            called = true;
                            console.log("GOT ALL POSTS : ");
                            console.log(posts);
                            cb(posts);
                            cb(posts);
                            posts = {};
                        } else {
                            console.log(got);
                            console.log(need);
                            console.log(Object.keys(got).length);
                        }
                    }
                }
            }
            Object.keys(cur.rules).forEach(function(key) {
                var rule = cur.rules[key];
                if (rule) {
                    switch (rule.type) {
                        case "yes_string":
                            need++;
                            get_even({
                                count: count * 2,
                                filter: "string",
                                filter_data: rule.value,
                                from: selfId,
                                rules: cur.rules,
                                original: selfId,
                                posts: {}
                            }, rec("yes_s_" + rule.value));
                            break;
                        case "yes_u":
                            need++;
                            get_even({
                                count: count * 2,
                                filter: "user",
                                filter_data: rule.value,
                                from: selfId,
                                rules: cur.rules,
                                original: selfId,
                                posts: {}
                            }, rec("yes_y"));
                            break;
                    }
                }
            });
            if (need == 0) {
                cb(posts);
            }
            cur.tags.forEach(function(tag) {
                console.log("GETTING TAG NOW : " + tag);
                get_even({
                    count: count * 2,
                    filter: "tag",
                    filter_data: [tag],
                    from: selfId,
                    rules: cur.rules,
                    original: selfId,
                    posts: {}
                }, rec(tag));
            });
        } else {
            cb(false);
        }
    });
}
var edit_cur_mod = new fulfill("edit_cur_mod", function(req) {
    if (curations[req.cur]) {
        if (curations[req.cur].own == req.uid) {
            return true;
        }
    }
    return false;
}, function(req) {
    Object.keys(req.changes).forEach(function(change) {
        if (curations[req.cur][change]) {
            curations[req.cur][change] = req.changes[change];
        }
    });
    updateCurs(curations[req.cur]);
    return true;
}, true, "once", true);
/*function twice(fn){
	var count = 0;
	return function(res){
		count++;
		if(count >=2){
			fn(res);
		}
	}
}*/
var socket = io.sockets;
console.log(socket);
if (process.argv[2] == "1") {
    setTimeout(function() {
        // createUser("nicohman", "dude");
    }, 10000);
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
        users[u.id] = u;
        updateUsers();
    },
    "update_curations": function(cur) {
        curations[cur.name] = cur;
        updateCurs();
    },
    "update_posts": function(post) {
        if (!posts[post.id]) {
            if (post.favorited) {
                post.favorited = undefined;
            }
            posts[post.id] = post;
            updatePosts();
        }
    },
    "get_user": function(id) {
        if (users[id.uid]) {
            onedir('got_user_' + id.uid, users[id.uid], flip(getDir(id.from)));
        } else {
            if (adjacent[getDir(flip(id.from))]) {
                passAlong('get_user', id);
            } else {
                onedir('got_user_' + id.uid, false, getDir(id.from));
            }
        }
    },
    "check_login": function(u) {
        if (users[u.uid]) {
            if (users[u.uid].banned) {
                onedir("check_result_" + u.uid, {
                    user: u.uid,
                    name: users[u.uid].username,
                    result: false
                }, getDir(u.from));
            } else {
                bcrypt.compare(u.pwd, users[u.pass], function(err, res) {
                    if (res) {
                        onedir("check_result_" + u.uid, {
                            user: u.uid,
                            name: users[u.uid].username,
                            result: res
                        }, getDir(u.from));
                    }
                });
            }
        } else {
            passAlong("check_login");
        }
    },
    "change_color": change_color,
    "c_change_color": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (!err) {
                if (dec.admin) {
                    console.log(req.email + "REQEMAIL");
                    change_color.easy({
                        color: req.color,
                        token: req.token,
                        uid: req.uid,
                        Temail: req.email
                    }, function(res) {
                        io.to(req.cid).emit("c_changed_color", res);
                    });
                } else {
                    io.to(req.cid).emit("c_changed_color", false);
                }
            } else {
                io.to(req.cid).emit("c_changed_color", false);
            }
        });
    },
    "c_check_ban": function(req) {
        io.to(req.cid).emit("c_checked_ban_" + req.uid, users[req.uid] && !users[
            req.uid].banned);
    },
    "c_ban": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (!err) {
                if (dec.admin) {
                    ban.easy({
                        uid: req.uid,
                        token: req.token
                    }, function(res) {
                        io.to(req.cid).emit("c_banned_" + req.uid, res);
                    });
                } else {
                    io.to(req.cid).emit("c_banned_" + req.uid, false);
                }
            } else {
                io.to(req.cid).emit("c_banned_" + req.uid, false);
            }
        });
    },
    "add_notif": add_notif,
    "rm_notif": rm_notif,
    "c_rm_notif": function(req) {
        jwt.verify(req.token, secret, function(err) {
            if (err) {
                console.log("TOKEN ERROR");
                io.to(req.cid).emit("c_rmed_notif_" + req.id, false);
            } else {
                rm_notif.easy({
                    token: req.token,
                    nid: req.id
                }, function(res) {
                    io.to(req.cid).emit("c_rmed_notif_" + req.id, res);
                });
            }
        });
    },
    "get_notifs": get_notifs,
    "c_unban": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (!err) {
                if (dec.admin) {
                    unban.easy({
                        uid: req.uid,
                        token: req.token
                    }, function(res) {
                        io.to(req.cid).emit("c_unbanned_" + req.uid, res);
                    });
                } else {
                    io.to(req.cid).emit("c_unbanned_" + req.uid, false);
                }
            } else {
                io.to(req.cid).emit("c_unbanned_" + req.uid, false);
            }
        });
    },
    "get_curs_top": get_curs_top,
    "c_get_curs_top": function(req) {
        get_curs_top.easy({
            count: 5,
            curs: []
        }, function(res) {
            io.to(req.cid).emit("c_got_curs_top", res.curs);
        });
    },
    "update_favs": favsUpdate,
    "add_comment": add_comment,
    "c_add_comment": function(req) {
        if (logged[req.cid]) {
            var color = false;
            if (users[logged[req.cid]] && users[logged[req.cid]].color) {
                color = users[logged[req.cid]].color;
            }
            add_comment.easy({
                uid: req.uid,
                pid: req.id,
                content: req.content,
                color: color,
                auth: req.auth,
                date: Date.now()
            }, function(res) {
                var reg = /@(\w+)/
                var match = reg.exec(req.content);
                console.log(match);
                if (match) {
                    get_post_by_id(req.id, function(post) {
                        var arr = [];
                        post.comments.forEach(function(com) {
                            arr.push(com);
                        });
                        arr.push({
                            auth: post.auth,
                            uid: post.uid
                        });
                        arr.filter(function(x) {
                            if (x) {
                                return true;
                            }
                        }).forEach(function(com) {
                            if (com.auth == match[1]) {
                                console.log("MATCHING");
                                console.log(com);
                                add_notif.easy({
                                    notif: {
                                        title: req.auth + " mentioned you in a post!",
                                        content: "View this at <a target='_blank' href='https://demenses.net/index.html#post?postid=" +
                                            req.id + "'>this post</a>",
                                        date: Date.now()
                                    },
                                    Tuid: com.uid,
                                    token: req.token,
                                }, function(res) {
                                    console.log("NOTIF MADE");
                                    console.log(res);
                                });
                            }
                        });
                    })
                }
                io.to(req.cid).emit("c_added_comment", res);
            });
        }
    },
    "add_reg": function(toAdd) {
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
    "unban": unban,
    "ban": ban,
    "create_curation": create_curation,
    "c_create_curation": function(req) {
        if (logged[req.cid]) {
            console.log("creating");
            var to_create = {
                    id: hash(req.name + Date.now()),
                    title: req.name,
                    uid: logged[req.cid],
                    from: selfId,
                    original: selfId,
                    tags: req.tags,
                    token: req.token
                }
                //get_curation_by_name(req.name, function(res) {
            var res = curations[req.name];
            if (res) {
                io.to(req.cid).emit("c_created_curation", "already");
            } else {
                add_cur_own.easy({
                    token: req.token,
                    cid: req.name
                }, function() {
                    create_curation(to_create, function(res) {
                        io.to(req.cid).emit("c_created_curation", res);
                    });
                });
            }
            //	});
        }
    },
    "c_change_email": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, dec) {
                console.log("decoded");
                if (!err) {
                    easyEmail({
                        email: req.email
                    }, function(u) {
                        if (u) {
                            if (u.id == dec.uid) {
                                io.to(req.cid).emit("c_changed_email", false);
                            }
                        } else {
                            console.log("Not already used!");
                            changeEmail.easy({
                                email: req.email,
                                token: req.token
                            }, function(res) {
                                io.to(req.cid).emit("c_changed_email", res);
                            });
                        }
                    });
                } else {
                    io.to(req.cid).emit("c_changed_email", false);
                }
            });
        }
    },
    "c_get_self_posts": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (!err) {
                if (dec.uid == logged[req.cid]) {
                    getPostsByUser(dec.uid, function(posts) {
                        posts.posts = checkFavs(users[logged[req.cid]].favorites, posts.posts);
                        io.to(req.cid).emit("c_got_self_posts", posts, req.count || 50);
                    });
                } else {
                    io.to(req.cid).emit("c_got_self_posts", false);
                }
            } else {
                io.to(req.cid).emit("c_got_self_posts", false);
            }
        });
    },
    "unsticky": unsticky,
    "sticky": sticky,
    "c_unsticky": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, dec) {
                if (!err) {
                    if (dec.admin) {
                        unsticky.easy({
                            token: req.token,
                            pid: req.pid
                        }, function(res) {
                            io.to(req.cid).emit("c_unstickied_" + req.pid, res);
                        });
                    } else {
                        io.to(req.cid).emit("c_unstickied_" + req.pid, false);
                    }
                } else {
                    io.to(req.cid).emit("c_unstickied_" + req.pid, false);
                }
            });
        }
    },
    "c_sticky": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, dec) {
                if (!err) {
                    if (dec.admin) {
                        sticky.easy({
                            token: req.token,
                            pid: req.pid
                        }, function(res) {
                            io.to(req.cid).emit("c_stickied_" + req.pid, res);
                        });
                    } else {
                        io.to(req.cid).emit("c_stickied_" + req.pid, false);
                    }
                } else {
                    io.to(req.cid).emit("c_stickied_" + req.pid, false);
                }
            });
        }
    },
    "change_email": changeEmail,
    "c_change_username": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err) {
                if (!err) {
                    change_username.easy({
                        token: req.token,
                        new_u: req.new_u
                    }, function(res) {
                        io.to(req.cid).emit("c_changed_username", res);
                    });
                } else {
                    io.to(req.cid).emit("c_changed_username", false);
                }
            });
        }
    },
    "c_get_cur_posts": function(req) {
        get_curation_posts(req.cur, function(posts) {
            var got = false;
            if (!got) {
                posts = checkFavs(users[logged[req.cid]].favorites, posts);
                io.to(req.cid).emit("c_got_cur_posts_" + req.cur + "_" + req.time,
                    posts);
                console.log("EMITTING EVENT C: " + req.time);
                got = true;
            }
        }, req.count);
    },
    "change_username": change_username,
    "c_req_rec": function(req) {
        if (!logged[req.cid]) {
            easyEmail({
                email: req.email
            }, function(u) {
                console.log(u);
                if (u) {
                    sendRecEmail(u.email, function() {
                        io.to(req.cid).emit("c_reqed_reced", true);
                    });
                } else {
                    io.to(req.cid).emit("c_reqed_reced", false);
                }
            });
        }
    },
    "get_posts": get_posts,
    "c_get_posts": function(req) {
        get_even({
            filter: req.filter,
            count: req.count,
            filter_data: req.data,
            original: selfId,
            from: selfId,
            posts: {}
        }, function(postsR) {
            postsR = checkFavs(users[logged[req.id]].favorites, postsR.posts);
            io.to(req.id).emit("c_got_posts_" + req.data, {
                posts: postsR
            });
        });
    },
    "delete_comment": delete_comment,
    "c_delete_comment": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (!err) {
                if (dec.admin) {
                    delete_comment.easy({
                        pid: req.pid,
                        cpos: req.cpos,
                        token: req.token
                    }, function(res) {
                        io.to(req.cid).emit("c_deleted_comment_" + req.pid, res);
                    });
                } else {
                    io.to(req.cid).emit("c_deleted_comment_" + req.pid, false);
                }
            } else {
                io.to(req.cid).emit("c_deleted_comment_" + req.pid, false);
            }
        });
    },
    "c_get_top": function(req) {
        get_even({
            filter: "favs",
            filter_data: "top",
            count: req.count,
            original: selfId,
            posts: {},
            from: selfId
        }, function(postsR) {
            postsR = checkFavsArr(users[logged[req.id || req.cid]].favorites, postsR
                .posts);
            console.log("GOT OTP< COUNT:" + Object.keys(postsR).length);
            console.log(postsR);
            io.to(req.id).emit("c_got_top", {
                posts: postsR
            })
        });
    },
    "get_curation": get_curation,
    "find_user_by_email": get_user_by_email,
    "c_find_user_by_email": function(req) {
        if (!logged[req.cid]) {
            //	easyEmail({email:req.email}, function(res) {
            io.to(req.cid).emit("c_found_user_by_email_" + req.email, search_email(req
                .email));
            console.log("Found!");
            //	});
        }
    },
    "delete_curation": delete_curation,
    "c_delete_curation": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, decode) {
                if (!err) {
                    get_curation_by_name(req.cur, function(cur) {
                        if (cur.own == decode.uid) {
                            delete_curation.easy({
                                token: req.token,
                                cur: req.cur
                            }, function(res) {
                                io.to(req.cid).emit("c_deleted_curation", res);
                            });
                        } else {
                            io.to(req.cid).emit("c_deleted_curation", false);
                        }
                    });
                } else {
                    io.to(req.cid).emit("c_deleted_curation", false);
                }
            });
        }
    },
    "delete_post": deletePost,
    "c_delete_post": function(req) {
        jwt.verify(req.token, secret, function(err, decode) {
            if (!err) {
                if (logged[req.cid] == decode.uid) {
                    easyDel(req.pid, req.token, function() {
                        console.log("Sending deleted");
                    });
                    setTimeout(function() {
                        io.to(req.cid).emit("c_deleted_post_" + req.pid, true)
                    }, 1200);
                } else {
                    io.to(req.cid).emit("c_deleted_post_" + req.pid, false);
                }
            } else {
                io.to(req.cid).emit("c_deleted_post_" + req.pid, false);
            }
        });
    },
    "c_get_favorites": function(req) {
        console.log("got request");
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                get_user(req.uid, function(user) {
                    console.log(user);
                    var favs = Object.keys(user.favorites);
                    var got = 0;
                    var full = [];
                    favs.forEach(function(fav) {
                        if (user.favorites[fav]) {
                            get_post_by_id(fav, function(post) {
                                full.push(post);
                                got++;
                                if (got >= favs.length) {
                                    io.to(req.cid).emit("c_got_favorites", full);
                                }
                            });
                        } else {
                            got++;
                            console.log(user.favorites[fav]);
                            if (got >= favs.length) {
                                io.to(req.cid).emit("c_got_favorites", full);
                            }
                        }
                    });
                })
            }
        }
    },
    "unfavorite": unfavorite,
    "c_unfavorite": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                unfavorite.easy({
                    pid: req.pid,
                    token: req.token
                }, function(res) {
                    if (res) {
                        io.to(req.cid).emit("c_unfavorited_" + req.pid, true);
                    }
                })
            }
        }
    },
    "add_favorite": add_favorite,
    "c_add_favorite": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                add_favorite.easy({
                    pid: req.pid,
                    token: req.token
                }, function(res) {
                    if (res) {
                        io.to(req.cid).emit("c_added_favorite_" + req.pid, true);
                    }
                });
            }
        }
    },
    "c_get_self": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, decode) {
                if (decode.uid == logged[req.cid]) {
                    get_user(decode.uid, function(user) {
                        io.to(req.cid).emit("c_got_self", user)
                    });
                }
            });
        }
    },
    "c_create_post": function(post) {
        if (logged[post.cid]) {
            if (!rec[logged[post.cid]]) {
                rec[logged[post.cid]] = {};
            }
            rec[logged[post.cid]][post.id] = Date.now();
            updateRec(logged[post.cid]);
            if (Object.keys(rec[logged[post.cid]]).length < 10) {
                createPost(post);
                io.to(post.cid).emit("c_created_post", true);
            } else {
                io.to(post.cid).emit("c_created_post", false);
            }
        }
    },
    "c_login": function(req) {
        easyEmail({
            email: req.email
        }, function(user) {
            console.log(user);
            if (user.banned) {
                io.to(req.cid).emit("c_logged_in_" + req.email, false);
            } else {
                bcrypt.compare(req.password, user.pass, function(err, res) {
                    if (res) {
                        console.log("User " + user.username + " successfully logged in");
                        var admin = false;
                        if (user.admin) {
                            admin = true;
                        }
                        var token = jwt.sign({
                            username: user.username,
                            uid: user.id,
                            email: req.email,
                            admin: admin
                        }, secret);
                        io.to(req.cid).emit("c_logged_in_" + req.email, token);
                        logged[req.cid] = req.uid;
                    } else {
                        console.log("User " + user.username +
                            " did not successfully log in")
                        io.to(req.cid).emit("c_logged_in_" + req.email, false);
                    }
                });
            }
        });
    },
    "c_create_user": function(req) {
        if (!logged[req.cid]) {
            createUser(req.username, req.password, req.email, function(id) {
                io.to(req.cid).emit("c_created_user", id);
            });
        }
    },
    "c_get_feed": function(req) {
        if (logged[req.cid]) {
            var toget = Object.keys(users[logged[req.cid]].tags).map(function(item) {
                if (users[logged[req.cid]].tags[item] == true) {
                    return {
                        type: 'tag',
                        tag: item
                    }
                } else {
                    return undefined;
                }
            }).filter(function(e) {
                if (e !== undefined) {
                    return true;
                } else {
                    return false;
                }
            });
            var to2 = Object.keys(users[logged[req.cid]].curs).map(function(key) {
                if (users[logged[req.cid]].curs[key] === true) {
                    return {
                        type: 'cur',
                        cur: key
                    }
                } else {
                    return undefined;
                }
            }).filter(function(e) {
                if (e !== undefined) {
                    return true;
                } else {
                    return false;
                }
            });
            toget.push.apply(toget, to2);
            console.log(toget);
            console.log(users[logged[req.cid]]);
            toget.count = req.count * 2;
            console.log("getting");
            get_feed(toget, function(postsR) {
                postsR = checkFavs(users[logged[req.cid]].favorites, postsR);
                io.to(req.cid).emit("c_got_feed_" + logged[req.cid], postsR);
            });
        }
    },
    "d_change_pass": function(req) {
        jwt.verify(req.token, emailSecret, function(err, un) {
            if (!err && req.pass1 == req.pass2) {
                change_pass.easy({
                    token: jwt.sign({
                        email: un.email,
                        pass: req.pass1
                    }, secret)
                }, function(res) {
                    io.to(req.cid).emit("d_changed_pass_" + un.email, res);
                });
            }
        });
    },
    "change_pass": change_pass,
    "unfollow": unfollow,
    "follow_tag": follow_tag,
    "follow_cur": follow_cur,
    "unfollow_cur": unfollow_cur,
    "c_follow_cur": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                follow_cur.easy({
                    uid: req.uid,
                    cur: req.cur,
                    token: req.token
                }, function(res) {
                    io.to(req.cid).emit("c_follow_cur_" + req.cur, res);
                })
            }
        }
    },
    "c_unfollow_cur": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                unfollow_cur.easy({
                    cur: req.cur,
                    token: req.token
                }, function(res) {
                    io.to(req.cid).emit("c_unfollow_cur_" + req.cur, res);
                })
            }
        }
    },
    "c_get_cur_mod": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, decode) {
                if (err || (decode.uid !== logged[req.cid])) {
                    console.log("Not who they appear to be");
                    io.to(req.cid).emit("c_got_cur_mod_" + req.cur, false);
                } else {
                    get_user(logged[req.cid], function(u) {
                        if (u.curations_owned[req.cur] === true) {
                            get_curation_by_name(req.cur, function(cur) {
                                io.to(req.cid).emit("c_got_cur_mod_" + req.cur, {
                                    rules: cur.rules,
                                    tags: cur.tags,
                                    favs: cur.favs
                                });
                            });
                        } else {
                            console.log("does not own curation");
                            //io.to(req.cid).emit("c_got_cur_mod_" + req.cur, false);
                            get_curation_by_name(req.cur, function(cur) {
                                io.to(req.cid).emit("c_got_cur_mod_" + req.cur, {
                                    favs: cur.favs
                                });
                            });
                        }
                    })
                }
            });
        }
    },
    "edit_cur_mod": edit_cur_mod,
    "c_edit_cur_mod": function(req) {
        if (logged[req.cid]) {
            jwt.verify(req.token, secret, function(err, decode) {
                if (err || (decode.uid !== logged[req.cid])) {
                    io.to(req.cid).emit("c_edited_cur_mod_" + req.cur, false);
                } else {
                    edit_cur_mod.easy({
                        cur: req.cur,
                        token: req.token,
                        changes: req.changes
                    }, function(res) {
                        io.to(req.cid).emit("c_edited_cur_mod_" + req.cur, res);
                    });
                }
                io.to(req.cid).emit("c_edited_cur_mod_" + req.cur, false);
            });
        }
    },
    "c_follow_tag": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                follow_tag.easy({
                    tag: req.tag,
                    token: req.token
                }, function(res) {
                    if (res) {
                        io.to(req.cid).emit("c_followed_tag_" + req.tag, true);
                    }
                });
            }
        } else {
            console.log("Not logged in!");
        }
    },
    "c_unfollow": function(req) {
        if (logged[req.cid]) {
            if (logged[req.cid] == req.uid) {
                unfollow.easy({
                    tag: req.tag,
                    token: req.token
                }, function(res) {
                    if (res) {
                        io.to(req.cid).emit("c_unfollowed_" + req.tag, true);
                    }
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
                get_user(decode.uid, function(res) {
                    if (res) {
                        if (res.banned) {
                            io.to(req.cid).emit("c_token_logged_in", false);
                        } else {
                            console.log("worked");
                            console.log(decode);
                            io.to(req.cid).emit("c_token_logged_in", decode);
                            logged[req.cid] = decode.uid
                        }
                    } else {
                        io.to(req.cid).emit("c_token_logged_in", false);
                    }
                });
            } else {
                io.to(req.cid).emit("c_token_logged_in", false);
            }
        })
    },
    "take_cur_own": take_cur_own,
    "c_get_post_by_id": function(req) {
        get_post_by_id(req.pid, function(res) {
            if (logged[req.cid]) {
                if (users[logged[req.cid]].favorites[req.pid] === true) {
                    res.favorited = true;
                }
            }
            io.to(req.cid).emit("c_got_post_by_id_" + req.pid, res);
        });
    },
    "c_get_notifs": function(req) {
        jwt.verify(req.token, secret, function(err, dec) {
            if (err) {
                io.to(req.cid).emit("c_got_notifs", false);
            } else {
                console.log(dec);
                get_notifs.easy({
                    token: req.token
                }, function(res) {
                    io.to(req.cid).emit("c_got_notifs", res);
                });
            }
        });
    },
    "create_post": createPost,
    "add_neighbor": function(toAdd) {
        console.log("NEIGHBOR ADDING");
        if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId && !
            adjacent[flip(toAdd.dir)]) {
            adjacent[flip(toAdd.dir)] = {
                id: toAdd.original,
                name: toAdd.name,
                ip: toAdd.ip
            };
            console.log("New neighbor, named " + toAdd.name +
                " from the direction of " + dirToString(getDir(toAdd.from)));
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
    console.log("CONNECTED TO" + process.argv[2]);
    gsocket.on("add_neighbor", function(res) {
        gsocket.on("disconnect", function() {
            delete adjacent[flip(res.dir)];
            console.log("removing");
        });
    });
    gsocket.on("*", function(data) {
        if (serv_handles[data.data[0]]) {
            serv_handles[data.data[0]](data.data[1]);
        }
        if (data.data[0] === "m_info") {
            console.log("M INFO OTHER");
        }
        server.emit(data.data[0], data.data[1]);
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
    console.log("attempting a connec tto " + to_connect);
    var client = socketclient(to_connect, {
        secure: true,
        transports: ['websocket']
    });
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
        console.log("connected to " + to_connect);
        client.on("*", function(data) {
            console.log(data.data[0]);
            if (serv_handles[data.data[0]]) {
                serv_handles[data.data[0]](data.data[1]);
            }
            if (!client_handles[data.data[0]] && client.hasListeners(data.data[0]) <
                1) {
                passAlong(data.data[0], data.data[1]);
                console.log("emit");
            }
            /*ff (client.hasListeners(data.data[0]) >= 1) {

            }*/
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
            if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId &&
                !adjacent[flip(toAdd.dir)]) {
                console.log(toAdd.from);
                adjacent[flip(toAdd.dir)] = {
                    id: toAdd.from,
                    name: toAdd.name,
                    ip: toAdd.ip,
                    dir: flip(toAdd.dir),
                    port: toAdd.port
                };
                console.log("New neighbor, named " + toAdd.name +
                    " from the direction of " + dirToString(getDir(toAdd.from)));
                client.on("disconnect", function() {
                    delete adjacent[flip(toAdd.dir)];
                });
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
    clients.push(client);
}
if (process.argv[2] == "1") {
    setTimeout(checkMe, 1000);
    setTimeout(checkYt, 2000);
    setTimeout(checkX, 3000);
    setTimeout(checkGames, 4000);
    setInterval(checkGames, 60000);
    setInterval(checkX, 60000)
    setInterval(checkYt, 1200000);
    setInterval(checkMe, 60000)
}