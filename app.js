var io = require('socket.io');
var socketclient = require('socket.io-client');
var ip = require('ip');
var format = require('biguint-format');
var FlakeId = require('flake-idgen')
var ports = ["2000", "3000", "4000"];
var names = ["dragon", "defiant", "dragon's teeth"];
var selfId = format(new FlakeId({
    datacenter: 1,
    worker: parseInt(process.argv[2])
}).next(), "dec");
var clients = [];
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
if (port != undefined) {
    var to_connect = 'http://localhost:' + port;
    createClient(to_connect);
} else {
    console.log("First!");
}
var to_open = ports[parseInt(process.argv[2])];
console.log(to_open);
io = io(to_open);
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
function passAlong(eventname, data){
	onedir(eventname, data, flip(getDir(data.from)));
}
function alldir(eventname, data) {
    clients.forEach(function(client) {
        client.emit(eventname, data);
    });
}
function onedir(eventname, data, dir) {
    if (clients[dir]) {
        clients[dir].emit(eventname, data);
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
function isNeighbor(id) {
    var neighbor = false;
    adjacent.forEach(function(adj) {
        if (adj.id === id) {
            neighbor = true;
        }
    })
    return neighbor;
}
io.on('connection', function(socket) {
    socket.on('add_reg', function(toAdd) {
        if (!reg[toAdd.from]) {

            reg[toAdd.from] = {
                name: toAdd.name,
                ip: toAdd.ip,
                id: toAdd.from
            };
            console.log("Added to registry " + toAdd.name);
            passAlong("add_reg", toAdd);
        } else {
            console.log(name + " already in registry");
        }
    });
    socket.on('get_reg', function(info) {
        socket.emit("got_reg_" + info.from, reg);
    });
    socket.on('add_neighbor', function(toAdd) {
        console.log("from:" + toAdd.from)
        if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId) {
            adjacent.push({
                id: toAdd.from,
                name: toAdd.name,
                ip: toAdd.ip
            });
            console.log("New neighbor, named " + toAdd.name + " from the direction of " + dirToString(getDir(toAdd.from)));
            socket.emit("neighbor_add_" + toAdd.from, {
                from: selfId,
                name: name,
                condition: "once",
                ip: ip.address()
            });
        } else {
            console.log("Couldn't add " + toAdd.name);
        }
    });
});
function createClient(to_connect) {
    var client = socketclient(to_connect);
    client.on('connect', function() {
        client.emit("add_neighbor", {
            from: selfId,
            condition: "once",
            name: name,
            ip: ip.address()
        });
        client.once("neighbor_add_" + selfId, function(toAdd) {
            if (adjacent.length < 2 && !isNeighbor(toAdd.id) && toAdd.id != selfId) {
                console.log(toAdd.from);
                adjacent.push({
                    id: toAdd.from,
                    name: toAdd.name,
                    ip: toAdd.ip
                });
                console.log("New neighbor, named " + toAdd.name + " from the direction of " + dirToString(getDir(toAdd.from)));
            }
        });
        client.emit("add_reg", {
            from: selfId,
            condition: "all",
            name: name,
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
    clients.push(client);
}
