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
var events = require('events');
var selfEmitter = new events.EventEmitter();
var server = new events.EventEmitter();
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
var curations = require("./curations.json");
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

function get_user_by_email(req, cb) {
	var found = false;
	console.log("email trigger");
	Object.keys(users).forEach(function(key) {
		if (users[key].email == req.email) {
			found = users[key];
		}
	});
	if (found && cb) {
		cb(found);
	} else if (found) {
		onedir("found_user_by_email_" + req.email, found, flip(getDir(req.from)));
	} else if (cb) {
		console.log("placing");
		when("found_user_by_email_" + req.email, cb);
		alldir("find_user_by_email", req);
	} else {
		if (adjacent[flip(getDir(req.from))]) {
			passAlong(req);
		} else {
			console.log("NOT FOUND");
			onedir("found_user_by_email_" + req.email, false, getDir(req.from));
		}
	}
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
		title: post.title,
		auth: post.auth,
		date: Date.now(),
		tags: post.tags,
		content: post.content,
		comments: [],
		favs: 0
	}
	updatePosts();
	alldir("update_posts", posts[id]);
}

function updatePosts() {
	sem.take(function() {
		var usersstring = JSON.stringify(posts);
		fs.writeFile('posts.json', usersstring, function(err) {
			if (err) {
				console.log("Error creating posts");
			} else {
				console.log("Created post successfully");
			}
			//	posts = require("./posts.json");
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
			criterion.posts = Object.keys(posts).map(function(m) {
				return posts[m];
			}).sort(cmpfavs).splice(0, criterion.count).concat(criterion.posts).sort(cmpfavs).splice(0, criterion.count);

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

function createUser(username, password, email, cb) {
	var id = hash(username + Date.now());
	bcrypt.hash(password, 10, function(err, hashed) {
		users[id] = {
			id: id,
			date: Date.now(),
			pass: hashed,
			username: username,
			subbed: [],
			email: email,
			tags: {},
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
	var need = toget.length
	var posts = {};

	function check() {
		console.log("MIDAY:");
		console.log(posts);
		if (gotten >= need) {
			cb(posts);
		}
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
						updateFavs(req.pid, 1);
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

function updateFavs(pid, num) {
	favsUpdate({
		from: selfId,
		original: selfId,
		pid: pid,
		num: num
	}, true);
	whenonce("updated_favs_" + pid + "_" + selfId, function(res) {

	});
}

function favsUpdate(req, ifself) {
	if (posts[req.pid]) {
		console.log("FAV UPDATE");
		posts[req.pid].favs += req.num;
		console.log(posts[req.pid].favs + " " + req.num);
		if (ifself) {
			io.sockets.emit("updated_favs_" + req.pid + "_" + req.original, posts[req.pid]);

		} else {
			onedir("updated_favs_" + req.pid + "_" + req.original, posts[req.pid], flip(getDir(req.from)));


		}
		updatePosts();
		//alldir("update_posts", posts[req.pid]);
	} else if (ifself) {
		alldir("update_favs", req);
	} else {
		passAlong("update_favs", req);
	}
}

function unfavorite(req, ifself) {
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
						updateFavs(req.pid, -1);
						updateUsers();
						alldir("update_users", users[req.uid]);
						if (ifself) {
							io.sockets.emit("unfavorited_" + req.uid + "_" + req.pid, users[req.uid]);
						} else {
							onedir("unfavorited_" + req.uid + "_" + req.pid, users[req.uid], flip(getDir(req.from)));
						}

					}
				}
			})
		}
	} else if (ifself) {
		alldir("unfavorite", req);
	} else {
		passAlong("unffavorite", req);

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
			original: selfId,
			id: id
		});
		when("got_curation_" + id, function(cur) {
			cb(cur);
		});
	}
}

function getPostsByCur(count, cur, cb) {
	var n = cur.rules.tags.length;
	var total = 0;
	var sort = cur.rules.sort;
	cur.rules.tags.forEach(function(tag) {
		get_even({


		}, function(posts) {});
	});
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
		if (!users[u.id]) {
			users[u.id] = u;
			updateUsers();
		}
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
	"create_curation": function(curation) {
		if (!curations[curation.id]) {
			jwt.verify(curation.token, secret, function(err, decode) {
				if (decode.uid == curation.uid) {
					curations[curation.id] = curation;
				}
			});
		}
	},
	"c_create_curation": function(req) {
		if (logged[req.cid]) {
			var to_create = {
				id: hash(req.title + Date.now()),
				title: req.title,
				uid: req.uid,
				from: selfId,
				original: selfId,
				rules: req.rules,
				token: req.token
			}
			serv_handles(to_create);
			alldir("create_curatioon", to_create);
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
			Object.keys(users[logged[req.id]].favorites).forEach(function(fav) {
				Object.keys(postsR.posts).forEach(function(key) {
					if (postsR.posts[key].id == fav && users[logged[req.id]].favorites[postsR.posts[key].id] == true) {
						console.log("UDPATEW");
						postsR.posts[key].favorited = true;
					}
				});
			});

			io.to(req.id).emit("c_got_posts_" + req.data, postsR);
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
			Object.keys(users[logged[req.id]].favorites).forEach(function(fav) {
				Object.keys(postsR.posts).forEach(function(key) {
					if (postsR.posts[key].id == fav && users[logged[req.id]].favorites[postsR.posts[key].id] == true) {
						//console.log("UDPATEW");
						postsR.posts[key].favorited = true;
					}
				});
			});

			io.to(req.id).emit("c_got_top", postsR)
		});
	},
	"get_curation": function(cur) {
		if (curations[cur.id]) {
			onedir("got_curation_" + cur.id, {
				title: curations[cur.id].title,
				rules: curations[cur.id].rules,
				uid: curations[cur.id].uid,
				from: selfId,
				original: selfId
			}, flip(getDir(cur.from)));
		} else {
			passAlong(cur);
		}
	},
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
				}, true);
				whenonce("unfavorited_" + req.uid + "_" + req.pid, function(res) {
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

				}, true);
				whenonce("added_favorite_" + req.uid + "_" + req.pid, function(res) {
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
		createPost(post);
		io.to(post.cid).emit("c_created_post", true);

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
			toget.count = 10;
			console.log("getting");
			get_feed(toget, function(postsR) {
				Object.keys(users[logged[req.cid]].favorites).forEach(function(fav) {

					Object.keys(postsR).forEach(function(key) {
						if (postsR[key].id == fav && users[logged[req.cid]].favorites[postsR[key].cid] == true) {
							console.log("UDPATEW");
							postsR[key].favorited = true;
						}
					});
				});

				console.log(postsR);
				console.log(users[logged[req.cid]]);
				console.log("c_got_feed_" + logged[req.cid]);
				io.to(req.cid).emit("c_got_feed_" + logged[req.cid], postsR);
			});
		}
	},
	"unfollow": unfollow,
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
				console.log("worked");
				console.log(decode);
				io.to(req.cid).emit("c_token_logged_in", decode);
				logged[req.cid] = decode.uid
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
