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
var DEMPATH = "/home/nicohman/.demenses/"
var san = require("sanitizer");
var events = require('events');
var nodemailer = require('nodemailer');
var selfEmitter = new events.EventEmitter();
var server = new events.EventEmitter();
var selfId = format(new FlakeId({
	datacenter: 1,
	worker: parseInt(process.argv[2])
}).next(), "dec");
var shahash = require('crypto');
var clients = [];
console.log(selfId)
var config = require(DEMPATH+"config.json");
var jwt = require("jsonwebtoken");
var name = names[parseInt(process.argv[2])];
console.log("I am the " + name);
var posts = require(DEMPATH+'posts_' + name + '.json');
var users = require(DEMPATH+"users_" + name + ".json");
var port = ports[parseInt(process.argv[2]) - 1];
console.log(port);
var curations = require(DEMPATH+"curations_"+name+".json");
var secret = config.secret;
var emailSecret = config.emailSecret;
var moment = require('moment')
var reg = {};
var rec = {};
reg[selfId] = {
	name: name,
	ip: ip.address(),
	id: selfId
};
var logged = {};
var smtpConf = {
	host: 'smtp.gmail.com',
	port: 465,
	secure: true,
	pool: true,
	auth: {
		user: 'nico.hickman@gmail.com',
		pass: config.emailpass
	}
}
var transporter = nodemailer.createTransport(smtpConf);
transporter.verify(function(err, suc) {
	if (err) {
		console.error(err);
		process.exit(0);
	}
});

function genRecLink(email, cb) {
	easyEmail(email, function(u) {
		if (u) {
			var token = jwt.sign({
				uid: u.id,
				email: email
			}, emailSecret, {
				expiresIn: 2700
			});
			var link = "http://24.113.235.229:3953/reset/" + token;
			cb(link);
		} else {
			cb(false);
		}
	});
}

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
		whenonce('got_user_' + uid, function(got) {
			cb(got);
		});
	}
}

function get_user_by_email(req, cb) {
	var found = false;
	console.log("email trigger");
	Object.keys(users).forEach(function(key) {
		if (users[key].email.trim() == req.email.trim()) {
			found = users[key];
		}
	});
	if (found && cb) {
		console.log("FOUND BY EMAIL");
		cb(found);
	} else if (found) {
		onedir("found_user_by_email_" + req.email, found, flip(getDir(req.from)));
	} else if (cb) {
		console.log("placing");
		when("found_user_by_email_" + req.email, cb);
		alldir("find_user_by_email", req);
	} else {
		if (adjacent[flip(getDir(req.from))]) {
			passAlong("find_user_by_email", req);
		} else {
			console.log("NOT FOUND");
			onedir("found_user_by_email_" + req.email, false, getDir(req.from));
		}
	}
}

function change_pass(req, cb) {
	jwt.verify(req.token, secret, function(err, un) {
		if (!err) {
			var found = false;
			Object.keys(users).forEach(function(key) {
				if (users[key].email.trim() == un.email.trim()) {
					found = key;
				}
			});
			if (found) {
				bcrypt.hash(un.pass, 10, function(err, hashed) {
					users[found].pass = hashed;
					alldir("update_users", users[found]);
					updateUsers();
				});
			}
			if (found && cb) {
				cb(true);
			} else if (found) {
				onedir("changed_pass_" + un.email, true, flip(getDir(req.from)));
			} else if (cb) {
				when("changed_pass_" + un.email, cb);
				alldir("change_pass", req);
			} else {
				if (adjacent[flip(getDir(req.from))]) {
					passAlong("change_pass", req);
				} else {
					console.log("NOT FOUND");
					onedir("changed_pass_" + un.email, false, getDir(req.from));
				}

			}
		}
	});
}



function change_pass_e(email, pass, cb) {
	var f = 0;
	console.log("changing");
	var tok = jwt.sign({
		pass: pass,
		email: email
	}, secret);
	change_pass({
		token: tok,
		from: selfId,
		original: selfId
	}, function(res) {
		if (res == false) {
			f++;
			if (f >= 2) {
				cb(false);
			} else {}
		} else {
			cb(res);
		}


	});
}

function easyEmail(email, cb) {
	var facount = 0;
	get_user_by_email({
		from: selfId,
		original: selfId,
		email: email
	}, function(res) {
		if (res == false) {
			facount++;
			if (facount >= 2) {
				cb(false);
			} else {
				console.log("DiasDIASD");
			}
		} else {
			cb(res);
		}
	});
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
	if (eventname == "found_user_by_email_nico.hickman@gmail.com") {
		console.log(dir);
		console.log(clients);
		console.log(data);
		console.log("DSADASRF");
	}
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
function updateCurs(){
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
}
function updatePosts() {
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

function whenonce(eventname, cb) {
	clients.forEach(function(client) {
		console.log("whenening");
		client.once(eventname, function(data) {
			//never(eventname);
			console.log("whened " + eventname + getDir(data.from));
			cb(data);
		});
	})
	io.once(eventname, function(data) {
		console.log("whened" + eventname + getDir(data.from));
		console.log(getDir(data.from));
		// never(eventname);
		cb(data)
	});
	selfEmitter.once(eventname, function(data) {
		console.log("whened" + eventname + getDir(data.from));

		cb(data)
	});

}

function never(eventname) {
	clients.forEach(function(client) {
		client.removeAllListeners(eventname);
	});
	io.removeAllListeners(eventname);
}

function cmpfavs(post1, post2) {
	if (post1.favs < post2.favs) {
		return 1;
	} else if (post1.favs > post2.favs) {
		return -1;
	} else {
		return 0;
	}
}

function get_posts(criterion, cb) {

	console.log("Request for posts");
	Object.keys(posts).forEach(function(key) {
		var post = posts[key]
		switch (criterion.filter) {
			case 'tag':
				console.log("tags");
				if (Object.keys(criterion.posts).length < criterion.count) {
					console.log("not enough");
					if (post.tags) {
						post.tags.forEach(function(tag) {
							criterion.filter_data.forEach(function(filter) {
								if (filter.trim() == tag.trim()) {

									console.log("Found a post");
									if (!criterion.posts[key]) {
										criterion.posts[key] = post;
									}
								}
							});
						});
					}
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
	if (criterion.filter == "favs") {
		console.log("favs");
		if (Object.keys(criterion.posts).length < criterion.count) {
			var check = Object.keys(posts).map(function(m) {
				return posts[m];
			}).sort(cmpfavs).splice(0, criterion.count);
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

			criterion.posts = check.concat(criterion.posts).sort(cmpfavs).splice(0, criterion.count);

		}

	}
	if (cb && Object.keys(criterion.posts).length >= criterion.count) {
		cb(criterion);

	} else if (cb) {
		alldir("get_posts", criterion);
		console.log("got_posts_" + criterion.filter + "_" + criterion.filter_data);
		var cbe = function(postse) {

			cb(postse);
		};
		var eventname = "got_posts_" + criterion.filter + "_" + criterion.filter_data;
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

function get_post_by_id(id, cb) {
	if (posts[id]) {
		cb(posts[id]);
	} else {
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
		})
	}
}

function get_even(criterion, cb) {
	var gotten = 0;
	var posts = {};
	//console.log(criterion.count + ": count : " + criterion.count / 2);
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
				}).sort(cmpfavs);
				posts.posts = fin;
			}

			//console.log(posts.posts);
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

		alldir("update_users", users[id]);
		users[id].original = true;
		updateUsers();
		cb(id);
	});
}
function get_feed(toget, cb) {
	var gotten = 0;
	var need = toget.length;
	var posts = {};
	var called = false;

	function check() {
		console.log("MIDAY:" + gotten + ":" + need);
		if (gotten >= need && !called) {

			cb(posts);
			console.log(posts);
			called = true;
		}
		console.log(toget);
		console.log("CALLING CB:" + need + ":" + gotten)

	}
	console.log(toget);
	toget.forEach(function(get) {
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
					console.log("respost");
					gotten++;
					Object.keys(gposts.posts).forEach(function(key) {
						console.log("I GOT ONE" + key)

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

function follow_tag(req, ifself, cb) {
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
							console.log("emitting");
							cb(true);

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
function follow_cur(req, cb){
	if(users[req.uid]){
		if(users[req.uid].original == true){
			jwt.verify(req.token, secret, function(err, decode){
				users[req.uid].curs[req.cur] = true;
				updateUsers();
				alldir("update_users", users[req.uid]);
				if(ifself){
					cb(true);
				} else {
					onedir("followed_cur_"+req.uid+"_"+req.cur, true, flip(getDir(req.from)));
				}
			});
		}
	} else if (cb){
		alldir("follow_cur", req);
		whenonce("followed_cur_"+req.uid+"_"+req.cur, cb);
	} else {
		if(adjacent[flip(getDir(req.from))]){
			passAlong("follow_cur", req);
		} else {
			onedir("followed_cur_"+req.uid+"_"+req.cur, false, getDir(req.from));
		}
	}

}
function unfollow_cur(req, cb){
	if(users[req.uid]){
		if(users[req.uid].original == true){
			jwt.verify(req.token, secret, function(err, decode){
				users[req.uid].curs[req.cur] = false;
				updateUsers();
				alldir("update_users", users[req.uid]);
				if(ifself){
					cb(true);
				} else {
					onedir("unfollowed_cur_"+req.uid+"_"+req.cur, true, flip(getDir(req.from)));
				}
			});
		}
	} else if (cb){
		alldir("unfollow_cur", req);
		whenonce("unfollowed_cur_"+req.uid+"_"+req.cur, cb);
	} else {
		if(adjacent[flip(getDir(req.from))]){
			passAlong("unfollow_cur", req);
		} else {
			onedir("unfollowed_cur_"+req.uid+"_"+req.cur, false, getDir(req.from));
		}
	}


}
function unfollow(req, ifself, cb) {
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
						users[req.uid].tags[req.tag] = false;
						updateUsers();
						alldir("update_users", users[req.uid]);
						if (ifself) {
							cb(true);
						} else {
							onedir("unfollowed_" + req.uid + "_" + req.tag, users[req.uid], flip(getDir(req.from)));
						}
					} else {
						console.log("Fradulent request recieved!");
					}
				}
			});
		}
	} else if (ifself) {
		alldir("unfollow", req);
	} else {
		passAlong("unfollow", req);

	}
}


function add_favorite(req, cb) {
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
						updateFavs(req.pid, 1, cb);
						alldir("update_users", users[req.uid]);
						if (cb) {
							//cb(users[req.uid]);
						} else {
							onedir("added_favorite_" + req.uid + "_" + req.pid, users[req.uid], flip(getDir(req.from)));
						}

					}
				}
			})
		}
	} else if (cb) {
		alldir("add_favorite", req);
		whenonce("added_favorite_" + req.uid + "_" + req.pid, cb);
	} else {
		passAlong("add_favorite", req);

	}

}

function updateFavs(pid, num, cb) {
	favsUpdate({
		from: selfId,
		original: selfId,
		pid: pid,
		num: num
	}, function(res) {
		if (cb) {
			cb(res)
		}
		console.log(res);
	});
}

function favsUpdate(req, cb) {
	if (posts[req.pid]) {
		console.log("FAV UPDATE");
		posts[req.pid].favs += req.num;
		console.log(posts[req.pid].favs + " " + req.num);
		if (cb) {
			alldir("update_favs", req);

			cb([req.pid]);
		} else {
			onedir("updated_favs_" + req.pid + "_" + req.original, posts[req.pid], flip(getDir(req.from)));
		}
		updatePosts();

		//alldir("update_posts", posts[req.pid]);
	} else if (cb) {
		console.log("MED FAV UPDATE");
		alldir("update_favs", req);
		whenonce("updated_favs_" + req.pid + "_" + req.original, cb);
	} else {
		console.log("NO FAV UPDATE");
		passAlong("update_favs", req);
	}
}

function change_username_e(uid, name, token, cb) {
	change_username({
		from: selfId,
		original: selfId,
		uid: uid,
		token: token,
		new_u: name
	}, cb);
}
function checkFavs(favs, rposts){
	var fposts = rposts;
	if(rposts.posts){
		fposts = rposts.posts;
	}

	Object.keys(favs).forEach(function(fav){
		if(favs[fav] === true){
			console.log("TRUE");
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
function checkFavsArr(favs, rposts){
	rposts.forEach(function(post, index){
		if(favs[post.id] ===true){
			rposts[index].favorited = true;
		}
	});
	return rposts
}
function change_username(req, cb) {
	console.log("func");
	if (users[req.uid]) {
		if (users[req.uid].original == true) {
			jwt.verify(req.token, secret, function(err, decode) {
				if (!err) {
					if (decode.uid == req.uid) {
						users[req.uid].username = req.new_u;
						updateUsers();
						alldir("update_users", users[req.uid]);
						if (cb) {
							console.log("callback");
							cb(true);
						} else {
							onedir("changed_username_" + req.uid, true, flip(getDir(req.from)));
						}
					}
				}
			});
		}
	} else if (cb) {
		alldir("change_username", req);
		whenonce("changed_username_" + req.uid, cb);
	} else {
		if (adjacent[getDir(flip(req.from))]) {
			passAlong("change_username", req);
		} else {
			onedir("changed_username_" + req.uid, false, flip(getDir(req.from)));

		}
	}
}

function unfavorite(req, cb) {
	if (users[req.uid]) {
		console.log("have user");
		if (users[req.uid].original == true) {
			console.log("verifying");
			jwt.verify(req.token, secret, function(err, decode) {
				if (err) {

					console.log(err);
				} else {
					if (decode.uid == req.uid) {
						users[req.uid].favorites[req.pid] = false;
						updateFavs(req.pid, -1, cb);
						updateUsers();
						alldir("update_users", users[req.uid]);
						if (cb) {
							cb(users[req.uid]);
						} else {
							onedir("unfavorited_" + req.uid + "_" + req.pid, users[req.uid], flip(getDir(req.from)));
						}

					}
				}
			})
		}
	} else if (cb) {
		alldir("unfavorite", req);
		whenonce("unfavorited_" + req.uid + "_" + req.pid, cb);
	} else {
		passAlong("unfavorite", req);

	}





}

function add_comment(comment, cb) {
	if (posts[comment.id]) {
		posts[comment.id].comments.push(comment);
		alldir("update_posts", posts[comment.id]);
		updatePosts();
		if (cb) {
			cb(true);
		} else {
			onedir("added_comment_" + comment.id + "_" + comment.auth, true, flip(getDir(comment.from)));
		}
	} else {
		if (cb) {
			alldir("add_comment", comment);
			when("added_comment_" + comment.id + "_" + comment.auth, cb);
		} else {
			if (adjacent[flip(getDir(commment.from))]) {
				passAlong(comment);
			}
		}
	}
}

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
	get_curation({
		from: selfId,
		filter: "name",
		filter_data: name,
		original: selfId
	}, function(res) {
		cb(res);
	});
}
function easy_add_own(uid, cid, cb){
	add_cur_own({from:selfId, original:selfId, uid:uid, cid:cid}, cb);
}
function add_cur_own(req, cb){
	if(users[req.uid]){
		users[req.uid].curations_owned[req.cid] = true;
		console.log("writing for curation");
		console.log(users[req.uid]);
		updateUsers();
		alldir("update_users", users[req.uid]);
		if(cb){
			cb(true);
		} else {
			onedir("added_own_"+req.cid, true, flip(getDir(req.from)));
		}

	} else if (cb){
		alldir("add_cur_own", req);
		var got = 0;
		when("added_cur_own_"+req.cid, function(res){
			got++;
			if(res){
				cb(res);
				never("added_cur_own_"+req.cid);
			} else if(got>=2){
				cb(false);
				never("added_cur_own_"+req.cid);

			}
		});
	} else if(adjacent[flip(getDir(req.from))]){
		passAlong("add_cur_own", req);
	} else {
		onedir("added_cur_own_"+req.cid, false, getDir(req.from));
	}
}
function get_curation(req, cb) {
	var found = false;
	if (req.filter == "name") {
		if (curations[req.filter_data]) {
			found = true;
			if (cb) {
				cb(curations[req.filter_data]);
			} else {
				onedir("got_curation_name_" + req.filter_data, curations[req.filter_data], flip(getDir(req.from)));
			}
		}
	}
	if (found) {

	} else if (!found && cb) {
		var got = 0;
		alldir("get_curation", req);
		when("got_curation_" + req.filter + "_" + req.filter_data, function(res) {
			got++;
			if (res) {
				cb(res);
				console.lgo("GOT CURATION");
				never("got_curation_" + req.filter + "_" + req.filter_data);
			} else if (got >= 2) {
				console.log("CAANT FIND");
				cb(false);

				never("got_curation_" + req.filter + "_" + req.filter_data);
			}
		});
	} else if (adjacent[flip(getDir(req.from))]) {
		passAlong("get_curation", req)
	} else {
		onedir("got_curation_" + req.filter + "_" + req.filter_data, false, getDir(req.from));
	}
}
function create_curation(req, cb){
	jwt.verify(req.token, secret, function(err, decode){
		if(decode.uid == req.uid){
			curations[req.title] = {
				tags:req.tags,
				rules:{},
				own:req.uid,
				name:req.title
			}
			alldir("update_curations", curations[req.title]);
			updateCurs();
			cb(true);
		}

	});
}
function updateRec(id) {
	Object.keys(rec[id]).forEach(function(key) {
		if (moment(rec[id][key]).isAfter(moment().subtract(1, 'days'))) {} else {
			delete rec[id][key]
		}
	});
}

function get_curation_posts(cur, cb, count){
	if(!count){

		count = 10;
	}
	var got = 0;
	var posts = {};
	get_curation_by_name(cur, function(cur){
		if(cur){
			var need = cur.tags.length;
			cur.tags.forEach(function(tag){
				get_even({
					count: count,
					filter: "tag",
					filter_data: [tag],
					from: selfId,
					original: selfId,
					posts: {}
				}, function(gotposts){
					gotposts = gotposts.posts;
					got++;
					Object.keys(gotposts).forEach(function(key){
						posts[key] = gotposts[key];
					});
					if(got >= need){
						cb(posts);
					}
				});
			});
		}else {
			cb(false);
		}
	});

}
function edit_cur_mod(req, cb){
	if(curations[req.cur]){
		jwt.verify(req.token, secret, function(err, decode){
			if(err){
				if(cb){
					cb(false);
				} else {
					onedir("edited_cur_mod_"+req.cur, false, getDir(req.from));
				}
			} else {
				if(curations[req.cur].own !== decode.uid){
					if(cb){
						cb(false)
					} else {
						onedir("edited_cur_mod_"+req.cur, false, getDir(req.from));
					}
				} else {
					Object.keys(req.changes).forEach(function(change){
						if(curations[req.cur][change]){
							curations[req.cur][change] = req.changes[change];
						} else {
							console.log("Invalid change");
						}
					});
					updateCurs();
					alldir("update_curs", curations[req.cur]);
					if (cb){
						cb(true);
					} else {
						onedir("edited_cur_mod_"+req.cur, true, getDir(req.from));

					}
				}
			}
		});
	} else if(cb){
		alldir("edit_cur_mod", req);
		when("edited_cur_mod_"+req.cur, twice(cb));
	} else {
		if(adjacent[flip(getDir(req.from))]){
			passAlong("edit_cur_mod_"+req.cur, req);
		} else {
			onedir("edited_cur_mod_"+req.cur, false, getDir(req.from));

		}
	}
}
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
	"update_favs": favsUpdate,
	"add_comment": add_comment,
	"c_add_comment": function(req) {
		if (logged[req.cid]) {
			add_comment({
				from: selfId,
				original: selfId,
				uid: req.uid,
				id: req.id,
				content: req.content,
				auth: req.auth,
				date: Date.now()
			}, function(res) {
				io.to(req.cid).emit("c_added_comment", res);
			});
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
				console.log(res);
				console.log("RES");
				if (res) {
					io.to(req.cid).emit("already");
				} else {
					easy_add_own(logged[req.cid], to_create.title, function(res){


						create_curation(to_create, function(res) {
							io.to(req.cid).emit("c_created_curation", res);
						});
					});
				}
			});
		}
	},
	"c_change_username": function(req) {
		if (logged[req.cid]) {
			jwt.verify(req.token, secret, function(err, dec) {
				if (!err) {
					change_username_e(dec.uid, req.new_u, req.token, function(res) {
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

			io.to(req.cid).emit("c_got_cur_posts", posts);
		}, req.count);
	},
	"change_username": change_username,
	"c_req_rec": function(req) {
		if (!logged[req.cid]) {
			easyEmail(req.email, function(u) {
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
			/*Object.keys(users[logged[req.id]].favorites).forEach(function(fav) {
				Object.keys(postsR.posts).forEach(function(key) {
					if (postsR.posts[key].id == fav && users[logged[req.id]].favorites[postsR.posts[key].id] == true) {
						console.log("UDPATEW");
						postsR.posts[key].favorited = true;
					}
				});
			});*/
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
			//console.log(Object.keys(postsR.posts));
			/*	Object.keys(users[logged[req.id]].favorites).forEach(function(fav) {
				Object.keys(postsR.posts).forEach(function(key) {
					if (postsR.posts[key].id == fav && users[logged[req.id]].favorites[postsR.posts[key].id] == true) {
			//console.log("UDPATEW");
						postsR.posts[key].favorited = true;
					}
				});
			})*/
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
			easyEmail(req.email, function(res) {
				io.to(req.cid).emit("c_found_user_by_email_" + req.email, res);
			});
		}
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
				unfavorite({
					from: selfId,
					original: selfId,
					uid: req.uid,
					pid: req.pid,
					token: req.token
				}, function(res) {
					console.log("SENDING EVENT BITCH");
					io.to(req.cid).emit("c_unfavorited_" + req.pid, true);
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
		easyEmail(req.email, function(user) {
			console.log(user);
			bcrypt.compare(req.password, user.pass, function(err, res) {
				if (res) {
					console.log("User " + user.username + " successfully logged in");
					var token = jwt.sign({
						username: user.username,
						uid: user.id,
						email: req.email
					}, secret);
					io.to(req.cid).emit("c_logged_in_" + req.email, token);
					logged[req.cid] = req.uid;
				} else {
					console.log("User " + user.username + " did not successfully log in")
					io.to(req.cid).emit("c_logged_in_" + req.email, false);
				}
			});
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
			console.log(toget);
			console.log(users[logged[req.cid]]);
			toget.count = req.count;
			console.log("getting");
			get_feed(toget, function(postsR) {
				/*	Object.keys(users[logged[req.cid]].favorites).forEach(function(fav) {

					Object.keys(postsR).forEach(function(key) {
						if (postsR[key].id == fav && users[logged[req.cid]].favorites[postsR[key].id] == true) {
							console.log("UDPATEW");
							postsR[key].favorited = true;
						}
					});
				});*/

				postsR = checkFavs(users[logged[req.cid]].favorites, postsR);

				console.log("c_got_feed_" + logged[req.cid]);
				io.to(req.cid).emit("c_got_feed_" + logged[req.cid], postsR);
			});
		}
	},
	"d_change_pass": function(req) {
		jwt.verify(req.token, emailSecret, function(err, un) {
			if (!err && req.pass1 == req.pass2) {
				change_pass_e(un.email, req.pass1, function(res) {
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
				follow_cur({from:selfId, original:selfId, uid:req.uid, cur:req.cur, token:req.token}, function(res){
					io.to(req.cid).emit("c_follow_cur_"+req.cur, res);
				})
			}
		}

	},
	"c_unfollow_cur":function(req){
		if(logged[req.cid]){
			if(logged[req.cid] == req.uid){
				unfollow_cur({from:selfId, original:selfId, uid:req.uid, cur:req.cur, token:req.token}, function(res){
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
						if(u.curations_owned[logged[req.cur]] === true){

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
					edit_cur_mod({
						from:selfId,
						original:selfId,
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
				follow_tag({
					from: selfId,
					original: selfId,
					uid: req.uid,
					tag: req.tag,
					token: req.token
				}, true, function(res) {
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
				unfollow({
					from: selfId,
					original: selfId,
					uid: req.uid,
					tag: req.tag,
					token: req.token

				}, true, function(res) {
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

						console.log("worked");
						console.log(decode);
						io.to(req.cid).emit("c_token_logged_in", decode);
						logged[req.cid] = decode.uid
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
	console.log("connected to " + to_connect);
}
