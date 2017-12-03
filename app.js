var io = require('socket.io');
var socketclient = require('socket.io-client');
var ip = require('ip');
var format = require('biguint-format');
var FlakeId = require('flake-idgen');
var passwordHash = require('password-hash');
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
var shahash = require('crypto').createHash('sha1');
var clients = [];
var users = require("./users.json");
var posts = {};
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
    return shahash.update(data, 'utf-8').digest('hex');
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

function getDir(id) {
    var index = -1;
    adjacent.forEach(function(newid, newindex) {
        if (newid.id === id) {
            index = newindex;
        }
    });
    return index;
}

function get_user(uid, socket, cb) {
    if (users[uid]) {
        cb(users[uid]);
    } else {
        alldir('get_user', {
            from: selfId,
            original: selfId,
            uid: uid,
            condition: 'fulfill'
        });
        socket.once('got_user_' + uid, function(got) {
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
    var from = data.from;
    console.log(from + " " + getDir(from));
    onedir(eventname, data, getDir(from));
}

function alldir(eventname, data) {
    console.log(clients);
    clients.forEach(function(client) {
        console.log("emit");
        client.emit(eventname, data);
    });
    io.emit(eventname, data);
}

function onedir(eventname, data, dir) {
    console.log(dir);
    //console.log(clients);
    if (clients[dir]) {
        console.log("hi");
        clients[dir].emit(eventname, data);
    } else {
        console.log("no hi");
    }
}

function createPost(post) {

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
    users[id] = {
        id: id,
        date: Date.now(),
        pass: passwordHash.generate(password),
        username: username,
        subbed: []
    }
    updateUsers();
    alldir("update_users", users[id]);
}
io.on('connection', function(gsocket) {
    io.emit("hi");
    var socket = io.sockets;
    console.log(socket);
    if (process.argv[2] == "1") {
        setTimeout(function() {
            createUser("nicohman", "dude");
        }, 10000);
    }
    console.log("co");
    var serv_handles = {
        "update_users": function(u) {
            if (!users[u.id]) {
                users[u.id] = u;
                updateUsers();
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
        "add_reg": function(toAdd) {
            console.log("recieve add");
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
        "create_post": createPost,
        "add_neighbor": function(toAdd) {
            console.log("from:" + toAdd.from)
            if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId && !adjacent[flip(toAdd.dir)]) {
                adjacent[flip(toAdd.dir)] = {
                    id: toAdd.original,
                    name: toAdd.name,
                    ip: toAdd.ip
                };
                console.log("adj:" + adjacent);
                //createClient("http://127.0.0.1:" + toAdd.port);

                console.log("New neighbor, named " + toAdd.name + " from the direction of " + dirToString(getDir(toAdd.from)));
                console.log("neighbor_add_" + toAdd.original);
                socket.emit("neighbor_add_" + toAdd.original, {
                    from: selfId,
                    name: name,
                    condition: "once",
                    port: to_open,
                    dir: flip(toAdd.dir),
                    ip: ip.address()
                });
                socket.emit("ho");
            } else {
                console.log("Couldn't add " + toAdd.name);
            }

        }
    }
    Object.keys(serv_handles).forEach(function(key) {
        console.log(key);
        gsocket.on(key, serv_handles[key]);
    });
    gsocket.on("*", function(data) {
        if (!serv_handles[data.data[0]]) {
            console.log("Passing along " + data.data[0]);
            passAlong(data.data[0], data.data[1]);
        } else {
            socket.emit("hi");
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
    console.log(to_connect);
    client.on('connect', function() {
        console.log("connect");
        client.on("*", function(data) {
            console.log("hillo");
            console.log(data.data[0]);
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
            console.log("req");
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
