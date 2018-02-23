//Initialize basic variables and require modules.
var io = require('socket.io'),socketclient = require('socket.io-client'),ip = require('ip'),format = require('biguint-format'),FlakeId = require('flake-idgen'),bcrypt = require('bcrypt'),ports = ["2000", "3000", "4000", "5000", "6000"],middleware = require("socketio-wildcard")(),patch = require("socketio-wildcard")(socketclient.Manager), fs = require("fs"), names = ["dragon", "defiant", "dragon's teeth", "saint", "weaver"], semaphore = require('semaphore'),sem = semaphore(1), DEMPATH = "/home/nicohman/.demenses/",san = require("sanitizer"), events = require('events'), nodemailer = require('nodemailer'), selfEmitter = new events.EventEmitter(), server = new events.EventEmitter(), shahash = require('crypto'),  clients = [], selfId = format(new FlakeId({datacenter: 1,worker: parseInt(process.argv[2])}).next(), "dec"),config = require(DEMPATH+"config.json"),jwt = require("jsonwebtoken"), name = names[parseInt(process.argv[2])], posts = require(DEMPATH+'posts_' + name + '.json'),users = require(DEMPATH+"users_" + name + ".json"),port = ports[parseInt(process.argv[2]) - 1],curations = require(DEMPATH+"curations_"+name+".json"),secret = config.secret,emailSecret = config.emailSecret,moment = require('moment'),reg = {},smtpConf = {host: 'smtp.gmail.com',port: 465,secure: true,pool: true,auth: {user: 'nico.hickman@gmail.com',pass: config.emailpass}},rec = {}, logged = {};
var https = require("https");
var express= require("express");
//Startup logs.
console.log("________                                                     \n\______ \   ____   _____   ____   ____   ______ ____   ______\n |    |  \_/ __ \ /     \_/ __ \ /    \ /  ___// __ \ /  ___/\n |    `   \  ___/|  Y Y  \  ___/|   |  \\___ \\  ___/ \___ \ \n/_______  /\___  >__|_|  /\___  >___|  /____  >\___  >____  >\n        \/     \/      \/     \/     \/     \/     \/     \/ ");
console.log("I am the node "+name+", with an id of "+selfId, " at the ip address "+ip.address());
//Provide registry lookup for self.
reg[selfId] = {
	name: name,
	ip: ip.address(),
	id: selfId
};
function Event(name, properties){
	if(!properties){
		var props = {}
	} else {
		var props = properties;
	}
	props.original = selfId;
	props.from = selfId;
	return function(func, newP){
		Object.keys(newP).forEach(function(key){
			props[key] = newP[key];
		});
		props.id = hash(Date.now()+selfId+name);
		func(name, props);
	}
}
function fulfill (name, condition, func, auth, amal, easy, def) {
	var doneFunc = function(req, cb){
		function others (){
			if (cb){
				alldir(name, req);
				var done = 0;
				var posts = {};
				var curs = [];
				when(name+req.id, function(res){
					done++;
					switch(amal){
						case "once":
							if(res){
								never(name+req.id);
								cb(res)
							} else if (done >= 2){
								cb(false);
								never(name+req.id);
							}
							break;
						case "posts":
							if(res){
								Object.keys(res.posts).forEach(function(key){
									if(!posts[key]){
										posts[key] = res.posts[key];
									}
								});
							}
							if(done >=2){
								cb(posts);
							}
							break;
						case "curs":
							if(res){
								curs = curs.concat(res.curs);
								curs = curs.sort(cmpcurfavs);
								curs.splice(0,res.count);
							}
							if (done >= 2){
								cb(curs);
							}
						default:
							console.log("Invalid amal option");
							never(name+req.id);
							break;
					}
				});
			} else if (adjacent[flip(getDir(req.from))]){
				passAlong(name, req);
			} else {
				onedir(name+req.id, false, getDir(req.from));
			}

		}

		if(auth){
			if(req.token){
				verify(req.token, function(res){
					if(res){
						var newreq = req;
						Object.keys(res).forEach(function(key){
							newreq[key] = res[key];
						});
						console.log("RES");
						console.log(req);
						var con = condition(newreq);
						if(con){
							var res = func(newreq, con);
							if(cb){
								cb(res);
							} else {
								onedir(name+req.id, res, getDir(req.from));
							}
						} else {
							others();
						}

					} else {
						if(cb){
							cb(false);
						} else {
							onedir(name+req.id, false, getDir(req.from));
						}
					}
				});
			} else {
				if(cb) {
					cb(false)
				} else {
					onedir(name+req.id, false, getDir(req.from));

				}
			}
		} else {
			var con = condition(req);
			if(con){
				var res = func(req, con);
				if(cb){
					cb(res);
				} else {
					onedir(name+req.id, res, getDir(req.from));
				}

			} else {
				others();
			}
		}}
	if(easy){
		console.log("PUTTING IN EASY MODE FOR "+name);
		doneFunc.easy = function(props, cb){
			var def = {from:selfId, original:selfId};
			Object.keys(props).forEach(function(key){
				def[key] = props[key];
			});
			def.id = hash(Date.now()+selfId+name);
			doneFunc(def, cb);
		};
	}

	return doneFunc;
}
var get_posts_top = new indefinite("get_curs_top", function(req){
	var check = Object.keys(posts).map(function(m) {
		return posts[m];
	}).sort(cmpfavs).sort(cmpstickied).splice(0, req.count);
	check.forEach(function(check2, index) {
		if (req.posts[check2.id]) {
			check = check.splice(index, 1);
		}
	});
	console.log("CHECK: ");
	console.log(check);

	check = check.map(function(m) {
		m.favs = posts[m.id].favs;
		return m;
	});
	req.posts = check.concat(req.posts).sort(cmpfavs).sort(cmpstickied).splice(0, req.count);
	return req;
}, function(req){}, false, function(req, cb, acc, t){
	if(!acc){
		acc = [];
	}
	acc.push(req.posts);
	acc.sort(cmpfavs).sort(cmpstickied).splice(0, req.count);
	if(t >= 3){
		cb(acc);
		return "fin";
	} else {
		return acc;
	}
}, true, {posts:[]});

function indefinite (name, exec, cond, auth, amal, easy, def) {
	var t = 0;
	var acc = undefined;
	function done (req, cb){
		if(cb){
			t++;
			acc = amal(req, cb, acc, t);
			if(acc === "fin"){
				never(name+req.id);
			}
		} else {
			onedir(name+req.id, req, flip(getDir(req.from)));
		}
	}
	var doneFunc = function(req, cb){
		req = exec(req);
		var con = cond(req);
		if(cb){
			done(req, cb);
			alldir(name, req);
			when(name+req.id, function(res){
				done(res, cb);
			});
		} else {

			if(con){
				done(req, cb);
			} else {
				if(adjacent[flip(getDir(req.from))]){
					passAlong(name, req);
				} else {
					onedir(name+req.id, req, flip(getDir(req.from)));
				}
			}
		}
	}
	if(easy){
		doneFunc.easy = function(props, cb){
			var def = {from:selfId, original:selfId};
			Object.keys(props).forEach(function(key){
				def[key] = props[key];
			});
			def.id = hash(Date.now()+selfId+name);
			doneFunc(def, cb);
		};
	}

	return doneFunc;

}
function verify(token, cb){
	jwt.verify(token, secret, function(err, decode){
		if(err){
			cb(false);
		} else {
			cb(decode);
		}
	});
}
var follow_cur = new fulfill("follow_cur",function(req){
	if(users[req.uid]){
		if(users[req.uid].original === true){
			return true;
		}
	}
	return false;
}, function(req){
	favsCur.easy({cid:req.cur, num:1}, function(){});
	users[req.uid].curs[req.cur] = true;
	updateUsers(users[req.uid]);
	return true;
}, true,  "once", true);
//Lets a user follow a curation. Event function.
//Set up nodemailer.
var transporter = nodemailer.createTransport(smtpConf);
transporter.verify(function(err, suc) {
	if (err) {
		console.error(err);
		process.exit(0);
	}
});
//Generates a Password reset link based on an user's email.
function genRecLink(email, cb) {
	easyEmail({email:email}, function(u) {
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
	var link = genRecLink(email, function(link) {
		if (link) {
			transporter.sendMail({
				from: 'demenses@demenses.net',
				to: email,
				subject: 'Recovery link for your Demenses account',
				text: 'Please use this link to reset your password: ' + link,
				html: '<p>Please use <a href="' + link + '">this</a> link to reset your password.</p>'

			}, function(err, info) {
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
var globsocket;
//Temporary code while I'm keeping all the nodes on one machine that lets them connect to each other.
var sslopts = {
	key: fs.readFileSync("/etc/letsencrypt/live/demenses.net/privkey.pem"),
	cert:fs.readFileSync("/etc/letsencrypt/live/demenses.net/fullchain.pem"),
};
//Setup socketio server connection.
var to_open = ports[parseInt(process.argv[2])];

var htt = https.Server(sslopts);
io = io(htt);
htt.listen(to_open);
io.use(middleware);
var adjacent = [];
if (port != undefined) {
	var to_connect = 'https://demenses.net:' + port;
	console.log("TOCONNECT"+to_connect);
	createClient(to_connect);
} else {
	console.log("First!");
}

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
	if (users[uid]) {
		cb(users[uid]);
	} else {
		alldir('get_user', {
			from: selfId,
			original: selfId,
			uid: uid,
			condition: 'fulfill'
		});
		whenonce('got_user_' + uid, function(got) {
			cb(got);
		});
	}
}
var emails = {}
function search_email(email){
	var found = false;
	console.log(email);
	if(emails[email]){
		found = users[emails[email]];
		return found;
	}
	Object.keys(users).forEach(function(key){
		if(users[key].email.trim() == email.trim()){
			if(!found){
				found = users[key];
			}
			emails[email] = key;
		}
	});
	if(!found){
		return false;
	} else {
		return found;
	}
}
var get_user_by_email = new fulfill("find_user_by_email", function(req){
	if( search_email(req.email)){
		return true;
	} else{
		return false;
	}
}, function(req, u){
		console.log("Found");
	return search_email(req.email)}, false, "once", true);
var easyEmail = get_user_by_email.easy;
//Get a user by email.

var change_pass = new fulfill("change_pass", function(req){
	console.log("REQ");
	console.log(req);
	return search_email(req.email);
}, function(req, u){
	bcrypt.hash(req.pass, 10, function(err, hashed) {
		users[u.id].pass = hashed;
		updateUsers(u);
	});

}, true, "once", true);
//Does exactly what it says on the tin. Used to reverse an event's direction.
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
//Passes given event along chain.
function passAlong(eventname, data) {
	var from = flip(getDir(data.from));
	data.from = selfId;
	onedir(eventname, data, from);
}
//Sends an event in all directions down the chain.
function alldir(eventname, data) {
	clients.forEach(function(client) {
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
	posts[id] = {
		id: id,
		title: san.escape(post.title),
		auth: post.auth,
		uid: post.uid,
		date: Date.now(),
		tags: post.tags.map(san.escape),
		content: san.escape(post.content),
		comments: [],
		favs: 0
	}
	updatePosts();
	alldir("update_posts", posts[id]);
}
//Writes curations to disk.
function updateCurs(cur){
	sem.take(function(){
		var curstring = JSON.stringify(curations);
		fs.writeFile(DEMPATH+"curations_"+name+".json", curstring, function(err){
			if(err){
				console.log("Error updating curations");
			}
			curations = require(DEMPATH+"curations_"+name+".json");
			sem.leave();
		});
	});
	if(cur){
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
		fs.writeFile(DEMPATH+'posts_' + name + '.json', usersstring, function(err) {
			if (err) {
				console.log("Error creating posts");
			} else {
				console.log("Created post successfully");
			}
			posts = require(DEMPATH+"posts_" + name + ".json");
			sem.leave();
		});
	})
	if(post){
		alldir("update_posts", post);
	}

};
//Adds a comment.
function addComment(comment) {
	if (posts[comment.postid]) {
		posts.comments.push(comment);
	}
}
//When given a number-based id, returns a human-readable string.
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
function cmpfavs(post1, post2) {
	var a2bo = 0;
	var a1bo = 0;
	if (post1.stickied){
		a1bo += 2000;
	} 
	if (post2.stickied){
		a2bo += 2000;
	}
	if (post1.favs + a1bo < post2.favs + a2bo) {
		return 1;
	} else if (post1.favs +a1bo > post2.favs + a2bo) {
		return -1;
	} else {
		return 0;
	}
	
}
function cmpstickied(post1, post2){
/*	if(post1.stickied && post2.stickied){
		return 0;
	} else if (post1.stickied){
		return -1;
	} else if (post2.stickied){
		retur*n 1;
	} else {*/
		return 0;
//	}
}
//Checks a post against a given set of curation rules to see whether it is allowed in.
function checkRules(post, rules){
	var ok = true;
	if(rules){
		Object.keys(rules).forEach(function(key){
			var rule = rules[key];
			switch (rule.type){
				case "not_u":
					if(post.uid == rule.value){
						ok = false;
					}
					break;
				case "no_string":
					if(post.content.indexOf(rule.value) !== -1){
						ok = false;
					}
					break;
			}
		});
	}
	if(ok){
		return true;
	} else {
		return false;
	}
}
//Get posts event function.
function get_posts(criterion, cb) {

	Object.keys(posts).forEach(function(key) {
		var post = posts[key]
		switch (criterion.filter) {
			case 'tag':
				if (Object.keys(criterion.posts).length < criterion.count) {
					if (post.tags) {
						post.tags.forEach(function(tag) {
							criterion.filter_data.forEach(function(filter) {
								if (filter.trim() == tag.trim()) {
									if (!criterion.posts[key]) {
										if(checkRules(post,criterion.rules)){
											criterion.posts[key] = post;
										}
									}
								}
							});
						});
					}
				} else {
					console.log(Object.keys(criterion.posts).length + " " + criterion.count);
				}
				break;
			case "user":
				if (Object.keys(criterion.posts).length < criterion.count) {
					console.log("LOOKING BY USER");
					if(post.uid.trim() == criterion.filter_data.trim()){
						console.log("FOUND A POST BY USER");
						if (!criterion.posts[key]) {
							if(checkRules(post,criterion.rules)){

								criterion.posts[key] = post;
							}
						}
					}
				}
				break;
			case "string":
				if(Object.keys(criterion.posts).length < criterion.count) {
					if(post.content.indexOf(criterion.filter_data) !== -1){
						if (!criterion.posts[key]) {
							if(checkRules(post,criterion.rules)){

								criterion.posts[key] = post;
							}
						}

					}
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
	if (criterion.filter == "favs") {
		console.log("favs");
		if (Object.keys(criterion.posts).length < criterion.count) {
			var check = Object.keys(posts).map(function(m) {
				return posts[m];
			}).sort(cmpfavs).sort(cmpstickied).splice(0, criterion.count);
			check.forEach(function(check2, index) {
				if (criterion.posts[check2.id]) {
					check = check.splice(index, 1);
				}
			});
			console.log("CHECK: ");
			console.log(check);

			check = check.map(function(m) {
				m.favs = posts[m.id].favs;
				return m;
			});

			criterion.posts = check.concat(criterion.posts).sort(cmpfavs).sort(cmpstickied).splice(0, criterion.count);

		}
	}
	if (cb && Object.keys(criterion.posts).length >= criterion.count) {
		cb(criterion);

	} else if (cb) {
		alldir("get_posts", criterion);
		console.log("got_posts_" + criterion.filter + "_" + criterion.filter_data);
		var count = 0;

		var eventname = "got_posts_" + criterion.filter + "_" + criterion.filter_data;
		var cbe = function(postse) {
			count++;
			if(count >=2){
				console.log("NEVERING");
				never(eventname);
			}
			cb(postse);

		};
		when(eventname, cbe);
	} else if (Object.keys(criterion.posts).length < criterion.count && adjacent[flip(getDir(criterion.from))]) {
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
}
//Get a post by id easily.
function get_post_by_id(id, cb) {
	if (posts[id]) {
		cb(posts[id]);
	} else {
		/*
		alldir("get_posts", {
			filter: "id",
			filter_data: id,
			from: selfId,
			original: selfId,
			count: 1,
			posts: {}
		});
		whenonce("got_posts_id_" + id, function(post) {
			cb(post.posts);
		})*/
		cb(false);
	}
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
				}).sort(cmpfavs).sort(cmpstickied);
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
function getPostsByUser(uid, cb, count){
	if(!count){
		count = 10;
	}
	get_even({filter:"user", count:count, filter_data:uid, from:selfId, original:selfId, posts:{}}, function(posts){
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
	if(u){
		alldir("update_users", u);
	}
	sem.take(function() {
		var usersstring = JSON.stringify(users);
		fs.writeFile(DEMPATH+'users_' + name + '.json', usersstring, function(err) {
			if (err) {
				console.log("Error creating user");
			} else {
				console.log("Created user successfully");
			}
			console.log("leaving! from "+name);
			sem.leave();
		});
	})
}
//Creates a user.
function createUser(username, password, email, cb) {
	var id = hash(username + Date.now());
	bcrypt.hash(password, 10, function(err, hashed) {
		users[id] = {
			id: id,
			date: Date.now(),
			pass: hashed,
			username: san.escape(username),
			subbed: [],
			curs:{},
			email: san.escape(email),
			tags: {},
			curations_owned:{},
			favorites: {}
		}
		users[id].original = true;
		updateUsers(users[id]);
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
	var called_tag = false;
	console.log("NEED:");
	console.log(toget);
	function check() {
		console.log("MIDAY:" + Object.keys(got).length + ":" + need);
		if (Object.keys(got).length >= need && !called) {
			console.log("Calling to get feed."+gotten+need);
			console.log(posts);
			cb(posts);
			called = true;
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
					console.log("respost "+gotten);
					got[get.tag] = true;
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

				get_curation_posts(get.cur, function(gposts){
					console.log("GOT CURATUION PSOTS");
					Object.keys(gposts).forEach(function(key){
						posts[key] = gposts[key];
					});

					console.log(posts);
					console.log("THOSE WERE C POSTS");
					got[get.cur.name] = true;
					check();
				}, amount);

			default:
				break;
		}
	});
}
//Lets a user follow a tag. Event function.
var follow_tag = new fulfill("follow_tag", function(req){
	if(users[req.uid]){
		if(users[req.uid].original === true){
			return true;
		}
	}
	return false;
}, function(req){
	users[req.uid].tags[req.tag] = true;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
//Lets a user unfollow a curation. Event function.
var unfollow_cur = new fulfill("unfollow_cur", function(req){
	if(users[req.uid]){
		return users[req.uid].original
	}
	return false;
}, function(req){
	favsCur.easy({num:-1, cid:req.cur}, function(){})
	users[req.uid].curs[req.cur] = false;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
var unfollow = new fulfill("unfollow", function(req){
	if(users[req.uid]){
		return users[req.uid].original
	}
	return false
}, function(req){
	users[req.uid].tags[req.tag] = false;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
//Lets a user unfollow a tag. Event function.
//Lets a user favorite a post.
var add_favorite = new fulfill("add_favorite", function(req){
	if(users[req.uid]){
		return users[req.uid].original
	}
	return false
}, function(req){
	users[req.uid].favorites[req.pid] = true;
	updateUsers(users[req.uid]);
	favsUpdate.easy({pid:req.pid, num:1}, function(){});
	return true;
}, true, "once", true);
var favsUpdate = new fulfill("update_favs", function(req){
	return posts[req.pid]
}, function(req){
	posts[req.pid].favs += req.num;
	updatePosts(posts[req.pid]);
	if(req.original == selfId){
		alldir("update_favs", req);
	}
	return true;
}, false, "once", true);

var favsCur = new fulfill("update_cur_favs", function(req){
	return curations[req.cid]
}, function(req){
	if(!curations[req.cid].favs){
		curations[req.cid].favs = 0;
	}
	curations[req.cid].favs += req.num;
	updateCurs(curations[req.cid]);
	if(req.original == selfId){
		alldir("update_cur_favs", req);
	}
	return true;
}, false, "once", true);
//Delete post event function. Requires either author's jwt token or admin status.
function deletePost(req, cb){
	if(posts[req.pid]){
		jwt.verify(req.token, secret, function(err, decode){
			if(!err){
				if(decode.uid == posts[req.pid].uid || decode.admin === true){
					delete posts[req.pid];
					updatePosts();
					req.deleted++;
					if (adjacent[flip(getDir(req.from))]){
						passAlong("delete_post", req);
					} else {
						if(cb){
							alldir('delete_post', req);
						} else {
							onedir("deleted_post_"+req.pid, req.deleted, flip(getDir(req.from)));
						}
					}
				} else {
					if(cb){
						cb(req.deleted)
					} else {
						onedir("deleted_post_"+req.pid, req.deleted, flip(getDir(req.from)));
					}

				}
			} else {
				if(cb){
					cb(req.deleted);
				} else{
					onedir("deleted_post_"+req.pid, req.deleted, flip(getDir(req.from)));
				}
			}
		});
	} else if (adjacent[flip(getDir(req.from))]){
		passAlong("delete_post", req);
	} else if(!cb){
		onedir("deleted_post_"+req.pid, req.deleted, flip(getDir(req.from)));
	} else if (cb){
		alldir("delete_post", req);
	}
	if(cb){
		var had = 0;
		var del = 0;
		when("deleted_post_"+req.pid, function(deli){
			had++;
			console.log("Would delete post");
			del += deli;
			if(had >= 2){
				never("deleted_post_"+req.pid);
				cb(del);
			}
		});
	}
}
// Easy way to delete a post given a token and pid.
function easyDel(pid, token, cb){
	deletePost({
		from:selfId,
		original:selfId,
		pid:pid,
		token:token,
		deleted:0
	}, function(res){
		console.log("DELETED POST");
		cb(res);
	});
}

//Iterates through posts, adding favorited to them where they match favs.
function checkFavs(favs, rposts){
	var fposts = rposts;
	if(rposts.posts){
		fposts = rposts.posts;
	}

	Object.keys(favs).forEach(function(fav){
		if(favs[fav] === true){
			if(fposts[fav]){
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
function checkFavsArr(favs, rposts){
	rposts.forEach(function(post, index){
		if(favs[post.id] ===true){
			rposts[index].favorited = true;
		}
	});
	return rposts
}
//Change username event function
var change_username = new fulfill("change_username", function(req){
	if(users[req.uid]){
		if(users[req.uid].original === true){
			return true;
		}
	}
	return false;
}, function(req){
	users[req.uid].username = req.new_u;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
var changeEmail = new fulfill("change_email", function(req){
	if(users[req.uid]){
		return users[req.uid].original
	}
	return false
}, function(req){
	users[req.uid].email = req.email;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
var unfavorite = new fulfill("unfavorite", function(req){
	if(users[req.uid]){
		return users[req.uid].original
	}
	return false
}, function(req){
	users[req.uid].favorites[req.pid] = false;
	updateUsers(users[req.uid]);
	favsUpdate.easy({pid:req.pid, num:-1}, function(){});
	return true;
}, true, "once", true);
var add_comment = new fulfill("add_comment", function(req){
	if (posts[req.pid]){
		return posts[req.pid];
	}else {
		console.log("It is not here"+req.pid);
	}
	return false;
}, function(req){
	posts[req.pid].comments.push(req);
	console.log("Added comment");
	updatePosts(posts[req.pid]);
	return true;
}, false, "once", true);
var sticky = new fulfill("sticky", function(req){
	return posts[req.pid];
}, function(req){
	if(req.admin) {
		posts[req.pid].stickied = true;
		updatePosts(posts[req.pid]);
		return true;
	}
	return false;
}, true, "once", true);
var unsticky = new fulfill("unsticky", function(req){
	return posts[req.pid];
}, function (req) {
	if (req.admin) {
		posts[req.pid].stickied = false;
		updatePosts(posts[req.pid]);
		return true;
	}
	return false;
}, true, "once", true);
function getCurationById(id, cb) {
	if (curations[id]) {
		cb(curations[id]);
	} else {
		alldir("get_curation", {
			from: selfId,
			original: selfId7,
			id: id
		});
		when("got_curation_" + id, function(cur) {
			cb(cur);
		});
	}
}
function get_curation_by_name(name, cb) {
	count = 0;
	get_curation.easy({
		filter: "name",
		filter_data: name
	}, function(res) {
		cb(res);
	});
}
var add_cur_own = new fulfill("add_cur_own", function(req){
	if(users[req.uid]){
		return users[req.uid]
	}
	return false;
}, function(req){
	users[req.uid].curations_owned[req.cid] = true;
	updateUsers(users[req.uid]);
	return true;
}, true, "once", true);
var get_curation = new fulfill('get_curation', function(req){
	if(req.filter == "name"){
		if(curations[req.filter_data]){
			return req.filter_data;
		}
	}
	return false;
}, function(req, s){
	return curations[s];
}, false, "once", true);
function create_curation(req, cb){
	jwt.verify(req.token, secret, function(err, decode){
		if(decode.uid == req.uid){
			curations[req.title] = {
				tags:req.tags,
				rules:{},
				own:req.uid,
				name:req.title
			}
			updateCurs(curations[req.title]);
			cb(true);
		}

	});
}
function cmpcurfavs (cur1, cur2){
	if (curations[cur1].favs && curations[cur2].favs){
		if(curations[cur1].favs > curations[cur2].favs){
			return -1;
		} else if (curations[cur1].favs < curations[cur2].favs){
			return 1;
		} else {
			return 0;
		}
	} else {
		if(curations[cur1].favs){
			return -1; 
		} else if(curations[cur2].favs){
			return 1;
		} else {
			return 0;
		}
	}
}
var get_curs_top = new fulfill("get_curs_top", function(req){
	req.curs = req.curs.concat(Object.keys(curations).sort(cmpcurfavs).splice(0, req.count));
	req.curs = req.curs.sort(cmpcurfavs).filter(function(elem, index, self){
		return index === self.indexOf(elem);
	}).splice(0,req.count);
	return !adjacent[flip(getDir(req.from))];
}, function(req){
	return req;	
}, false, "curs", true, {curs:[]});
function updateRec(id) {
	Object.keys(rec[id]).forEach(function(key) {
		if (moment(rec[id][key]).isAfter(moment().subtract(1, 'days'))) {} else {
			delete rec[id][key]
		}
	});
}
var ban = new fulfill(function(req){
	return users[req.uid] && users[req.uid].original;
}, function(req){
	if(req.admin){
		users[req.uid].banned = true;
		updateUsers(users[req.uid]);
		return true;
	}
	return false;
}, true, "once", true);
var unban = new fulfill(function(req){
	return users[req.uid] && users[req.uid].original;
}, function(req){
	if(req.admin){
		users[req.uid].banned = false;
		updateUsers(users[req.uid]);
		return true;
	}
	return false;
}, true, "once", true);
function get_curation_posts(cur, cb, count){
	if(!count){

		count = 10;
	}
	var got = 0
	var called = false;
	var posts = {};
	var got = {};
	get_curation_by_name(cur, function(cur){
		if(cur){

			var need = cur.tags.length
			var rec = function(name) {
				return function(gotposts){
					if(gotposts.posts){
						console.log("GET EVEN CALLED")
						gotposts = gotposts.posts;
						Object.keys(gotposts).forEach(function(key){
							posts[key] = gotposts[key];
						});
						got[name] = true;
						if(Object.keys(got).length >= need && !called){
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
			Object.keys(cur.rules).forEach(function(key){
				var rule = cur.rules[key];
				switch(rule.type){
					case "yes_string":
						need++;
						get_even({
							count: count*2,
							filter: "string",
							filter_data: rule.value,
							from: selfId,
							rules:cur.rules,
							original: selfId,
							posts: {}
						}, rec("yes_s"));
						break;
					case "yes_u":
						need++;
						get_even({
							count: count*2,
							filter: "user",
							filter_data: rule.value,
							from: selfId,
							rules:cur.rules,
							original: selfId,
							posts: {}
						}, rec("yes_y"));
						break;

				}
			});
			if(need == 0){
				cb(posts);
			}
			cur.tags.forEach(function(tag){
				console.log("GETTING TAG NOW : "+tag);
				get_even({
					count: count*2,
					filter: "tag",
					filter_data: [tag],
					from: selfId,
					rules:cur.rules,
					original: selfId,
					posts: {}
				}, rec(tag));
			});
		}else {
			cb(false);
		}
	});

}
var edit_cur_mod = new fulfill("edit_cur_mod", function(req){
	if(curations[req.cur]){
		if(curations[req.cur].own == req.uid){
			return true;
		}
	}
	return false;
}, function(req){
	Object.keys(req.changes).forEach(function(change){
		if(curations[req.cur][change]){
			curations[req.cur][change]  = req.changes[change];
		}
	});
	updateCurs(curations[req.cur]);
	return true;
}, true, "once", true);
function twice(fn){
	var count = 0;
	return function(res){
		count++;
		if(count >=2){
			fn(res);
		}
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
	"update_curations":function(cur){
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
			if(adjacent[getDir(flip(id.from))]){
				passAlong('get_user', id);
			} else {
				onedir('got_user_' + id.uid, false, getDir(id.from));

			}
		}
	},
	"check_login": function(u) {
		if (users[u.uid]) {
			if(users[u.uid].banned){
				onedir("check_result_"+u.uid, {
					user:u.uid,
					name:users[u.uid].username,
					result:res
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
	"c_check_ban":function(req){
		io.to(req.cid).emit("c_checked_ban_"+req.uid, users[req.uid] && !users[req.uid].banned);
	},
	"c_ban":function(req){
		jwt.verify(req.token, secret, function(err, dec){
			if(!err){
				if(dec.admin){
					ban.easy(
						{
							uid:req.uid,
							token:req.token
						}, function(res){
							io.to(req.cid).emit("c_banned_"+req.uid, res);
						});
				} else {
					io.to(req.cid).emit("c_banned_"+req.uid, false);
				}
			} else {
				io.to(req.cid).emit("c_banned_"+req.uid, false);
			}
		});
	},
	"c_unban":function(req){
		jwt.verify(req.token, secret, function(err, dec){
			if(!err){
				if(dec.admin){
					unban.easy(
						{
							uid:req.uid,
							token:req.token
						}, function(res){
							io.to(req.cid).emit("c_unbanned_"+req.uid, res);
						});
				} else {
					io.to(req.cid).emit("c_unbanned_"+req.uid, false);
				}
			} else {
				io.to(req.cid).emit("c_unbanned_"+req.uid, false);
			}
		});

	},
	"get_curs_top":get_curs_top,
	"c_get_curs_top":function(req){
		get_curs_top.easy({count:5,curs:[]}, function(res){
			io.to(req.cid).emit("c_got_curs_top",res.curs); 
		});
	},
	"update_favs": favsUpdate,
	"add_comment": add_comment,
	"c_add_comment": function(req) {
		if (logged[req.cid]) {
			add_comment.easy({
				uid: req.uid,
				pid: req.id,
				content: req.content,
				auth: req.auth,
				date: Date.now()
			}, function(res) {
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
	"unban":unban,
	"ban":ban,
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
			get_curation_by_name(req.name, function(res) {
				if (res) {
					io.to(req.cid).emit("c_created_curation", "already");
				} else {
					add_cur_own.easy({token:req.token, cid:req.name}, function(res){
						console.log("added ownership");
						create_curation(to_create, function(res) {
							io.to(req.cid).emit("c_created_curation", res);
						});
					});
				}
			});
		}
	},
	"c_change_email":function(req){
		if(logged[req.cid]){
			jwt.verify(req.token, secret, function(err, dec){
				console.log("decoded");
				if(!err){
					easyEmail({email:req.email}, function(u){
						if(u){
							io.to(req.cid).emit("c_changed_email", false);
						} else
						{
							console.log("Not already used!");
							changeEmail.easy({email:req.email ,token:req.token}, function(res){
								io.to(req.cid).emit("c_changed_email", res);
							});
						}
					});
				}else {
					io.to(req.cid).emit("c_changed_email", false);
				}
			});
		}
	},
	"c_get_self_posts":function(req){
		jwt.verify(req.token, secret, function(err, dec){
			if(!err){
				if(dec.uid == logged[req.cid]){
					getPostsByUser(dec.uid, function(posts){
						io.to(req.cid).emit("c_got_self_posts", posts, req.count || 10);
					});
				} else {
					io.to(req.cid).emit("c_got_self_posts", false);
				}
			} else {
				io.to(req.cid).emit("c_got_self_posts", false);
			}
		});
	},
	"unsticky":unsticky,
	"sticky":sticky,
	"c_unsticky":function(req){
		if (logged[req.cid]){
			jwt.verify(req.token, secret, function(err, dec){
				if (!err) {
					if(dec.admin){
						unsticky.easy({token:req.token, pid:req.pid}, function(res){
							io.to(req.cid).emit("c_unstickied_"+req.pid, res);
						});
					} else {
						io.to(req.cid).emit("c_unstickied_"+req.pid, false);
					}
				} else {
					io.to(req.cid).emit("c_unstickied_"+req.pid, false);
				}
			});
		}
	},
	"c_sticky":function(req){
		if (logged[req.cid]){
			jwt.verify(req.token, secret, function(err, dec){
				if (!err)
				{
					if (dec.admin){
						sticky.easy({token:req.token, pid:req.pid}, function(res){
							io.to(req.cid).emit("c_stickied_"+req.pid, res);
						});
					} else {
						io.to(req.cid).emit("c_stickied_"+req.pid, false);
					}
				} else {
					io.to(req.cid).emit("c_stickied_"+req.pid, false);
				}
			});
		}
	},
	"change_email":changeEmail,
	"c_change_username": function(req) {
		if (logged[req.cid]) {
			jwt.verify(req.token, secret, function(err, dec) {
				if (!err) {
					change_username.easy({token:req.token, new_u:req.new_u}, function(res) {
						io.to(req.cid).emit("c_changed_username", res);
					});
				} else {
					io.to(req.cid).emit("c_changed_username", false);
				}
			});
		}
	},
	"c_get_cur_posts":function(req){
		get_curation_posts(req.cur, function(posts){
			var got = false;
			if(!got){
				io.to(req.cid).emit("c_got_cur_posts_"+req.cur+"_"+req.time, posts);
				console.log("EMITTING EVENT C: "+req.time);
				got = true;
			}
		}, req.count);
	},
	"change_username": change_username,
	"c_req_rec": function(req) {
		if (!logged[req.cid]) {
			easyEmail({email:req.email}, function(u) {
				console.log(u);

				if (u) {
					sendRecEmail(u.email, function(res) {
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
			io.to(req.id).emit("c_got_posts_" + req.data,{posts: postsR});
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
			postsR = checkFavsArr(users[logged[req.id]].favorites, postsR.posts);
			console.log("GOT OTP< COUNT:" + Object.keys(postsR).length);
			console.log(postsR);
			io.to(req.id).emit("c_got_top", {posts:postsR})
		});
	},
	"get_curation": get_curation,
	"find_user_by_email": get_user_by_email,
	"c_find_user_by_email": function(req) {
		if (!logged[req.cid]) {
		//	easyEmail({email:req.email}, function(res) {
				io.to(req.cid).emit("c_found_user_by_email_" + req.email, search_email(req.email));
				console.log("Found!");
		//	});
		}
	},
	"delete_post":deletePost,
	"c_delete_post":function(req){
		jwt.verify(req.token, secret, function(err, decode){
			if(!err){
				if(logged[req.cid] == decode.uid){
					easyDel(req.pid, req.token, function(res){
						io.to(req.cid).emit("c_deleted_post_"+req.pid, res)
					});
				} else {
					io.to(req.cid).emit("c_deleted_post_"+req.pid, false);

				}
			} else {
				io.to(req.cid).emit("c_deleted_post_"+req.pid, false);
			}
		});
	},
	"c_get_curation_posts": function(req) {
		getCurationById(req.id, function(curation) {
			io.to(req.cid).emit("c_got_curation_" + req.id);
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
					io.to(req.cid).emit("c_unfavorited_" + req.pid, true);
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
					io.to(req.cid).emit("c_added_favorite_" + req.pid, true);
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
		easyEmail({email:req.email}, function(user) {
			console.log(user);
			if (user.banned){
				io.to(req.cid).emit("c_logged_in_"+req.email, false);
			} else {
				bcrypt.compare(req.password, user.pass, function(err, res) {
					if (res) {
						console.log("User " + user.username + " successfully logged in");
						var admin = false;
						if(user.admin){
							admin = true;
						}
						var token = jwt.sign({
							username: user.username,
							uid: user.id,
							email: req.email,
							admin:admin
						}, secret);
						io.to(req.cid).emit("c_logged_in_" + req.email, token);
						logged[req.cid] = req.uid;
					} else {
						console.log("User " + user.username + " did not successfully log in")
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
			var to2 = Object.keys(users[logged[req.cid]].curs).map(function(key){
				if (users[logged[req.cid]].curs[key] === true) {
					return {
						type:'cur',
						cur:key
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

				console.log("c_got_feed_" + logged[req.cid]);
				io.to(req.cid).emit("c_got_feed_" + logged[req.cid], postsR);

			});
		}
	},
	"d_change_pass": function(req) {
		jwt.verify(req.token, emailSecret, function(err, un) {
			if (!err && req.pass1 == req.pass2) {
				change_pass.easy({token:jwt.sign({email:un.email, pass:req.pass1}, secret)}, function(res) {
					io.to(req.cid).emit("d_changed_pass_" + un.email, res);
				});
			}
		});
	},
	"change_pass": change_pass,
	"unfollow": unfollow,
	"follow_tag": follow_tag,
	"follow_cur":follow_cur,
	"unfollow_cur":unfollow_cur,
	"c_follow_cur":function(req){
		if(logged[req.cid]){
			if(logged[req.cid] == req.uid) {
				follow_cur.easy({uid:req.uid, cur:req.cur, token:req.token}, function(res){
					io.to(req.cid).emit("c_follow_cur_"+req.cur, res);
				})
			}
		}

	},
	"c_unfollow_cur":function(req){
		if(logged[req.cid]){
			if(logged[req.cid] == req.uid){
				unfollow_cur.easy({cur:req.cur, token:req.token}, function(res){
					io.to(req.cid).emit("c_unfollow_cur_"+req.cur, res);
				})

			}
		}

	},
	"c_get_cur_mod":function(req){
		if(logged[req.cid]){
			jwt.verify(req.token, secret, function(err, decode){
				if(err || (decode.uid !== logged[req.cid])){
					console.log("Not who they appear to be");
					io.to(req.cid).emit("c_got_cur_mod_"+req.cur, false);
				} else {
					get_user(logged[req.cid], function(u){
						if(u.curations_owned[req.cur] === true){

							get_curation_by_name(req.cur, function(cur){
								io.to(req.cid).emit("c_got_cur_mod_"+req.cur, {
									rules:cur.rules,
									tags:cur.tags
								});
							});
						} else {
							console.log("does not own curation");
							io.to(req.cid).emit("c_got_cur_mod_"+req.cur, false);
						}
					})}
			});
		}
	},
	"edit_cur_mod":edit_cur_mod,
	"c_edit_cur_mod":function(req){
		if(logged[req.cid]){
			jwt.verify(req.token, secret, function(err, decode){
				if(err || (decode.uid !== logged[req.cid])){
					io.to(req.cid).emit("c_edited_cur_mod_"+req.cur, false);
				} else {
					edit_cur_mod.easy({
						cur:req.cur,
						token:req.token,
						changes:req.changes
					}, function(res){
						io.to(req.cid).emit("c_edited_cur_mod_"+req.cur, res);
					});
				}
				io.to(req.cid).emit("c_edited_cur_mod_"+req.cur, false);
			});
		}
	},
	"c_follow_tag": function(req) {
		if (logged[req.cid]) {
			if (logged[req.cid] == req.uid) {
				follow_tag.easy({
					tag: req.tag,
					token: req.token
				},  function(res) {
					console.log("FsaJF");
					console.log("c_followed_tag_" + req.tag + "\n " + req.cid);
					io.to(req.cid).emit("c_followed_tag_" + req.tag, true);
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
					io.to(req.cid).emit("c_unfollowed_" + req.tag, true);
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
				get_user(decode.uid, function(res){
					if(res){
						if(res.banned){
							io.to(req.cid).emit("c_token_logged_in",false);
						} else {

							console.log("worked");
							console.log(decode);
							io.to(req.cid).emit("c_token_logged_in", decode);
							logged[req.cid] = decode.uid
						}
					} else {
						io.to(req.cid).emit("c_token_logged_in", false);
					}});
			} else {
				io.to(req.cid).emit("c_token_logged_in", false);
			}
		})
	},
	"c_get_post_by_id": function(req) {
		get_post_by_id(req.pid, function(res) {
			io.to(req.cid).emit("c_got_post_by_id", res);
		});
	},
	"create_post": createPost,
	"add_neighbor": function(toAdd) {
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
		//	console.log(key);
		//	console.log(serv_handles[key]);
		gsocket.on(key, serv_handles[key]);
	});
	gsocket.on("*", function(data) {
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
	var client = socketclient(to_connect, {secure:true});
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
		console.log("connect");
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
			if (client.hasListeners(data.data[0]) >= 1) {

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
