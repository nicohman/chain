window.onload = function() {
	var client = io("http://24.113.235.229:3000");
	var loggedin = {};
	var resultsTag;
	var home_num = 10;
	var cur_show = "home";
	var resCur = false;
	function prevent(e){
		if(e.preventDefault){
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
	}
	Object.keys(schemes).forEach(function(scheme){
		var sel = document.createElement("option");
		sel.value = scheme;
		sel.innerHTML = scheme;
		document.getElementById("cs-select").appendChild(sel);
	});
	document.getElementById("cs-form").addEventListener("submit", function(e){
		prevent(e);
		localStorage.setItem("colorscheme", e.target["cs-select"].value)
		changeColorscheme(e.target["cs-select"].value);
	});
	var cur_com = "";
	var token = localStorage.getItem("auth_token");
	var chain = {
		attempt_login: function attempt_login(uid, password, cb) {
			client.emit("c_login", {
				uid: uid,
				password: password,
				cid: client.id
			});

			client.once("c_logged_in_" + uid, function(newtoken) {
				console.log("res");
				if (newtoken) {
					token = newtoken
					localStorage.setItem("auth_token", newtoken);
					login();
				}
				cb(null, newtoken);
			});
		},
		get_cur_mod:function(cur, cb){
			client.emit("c_get_cur_mod", {
				token:token,
				cid:client.id,
				cur:cur,
				uid:loggedin.uid
			});
			client.once("c_got_cur_mod_"+cur, cb);
		},
		change_email:function(email, cb){
			client.emit("c_change_email", {
				token:token,
				uid:loggedin.uid,
				email:email
			});
			client.once("c_changed_email", cb);
		},
		edit_cur_mod:function(cur, ed, cb){
			client.emit("c_edit_cur_mod", {
				cur:cur,
				cid:client.id,
				uid:loggedin.uid,
				token:token,
				changes:ed
			});
			client.once("c_edited_cur_mod_"+cur, cb);
		},
		get_curation: function get_curation(id, cb) {
			client.emit("c_get_curation", {
				cid: client.id,
				id: id
			});
			client.once("c_got_curation_" + id, function(cur) {
				cb(cur);
			});
		},
		create_curation: function(name, tags, cb){
			client.emit("c_create_curation", {
				cid:client.id,
				token:token,
				tags:tags,
				name:name
			});
			client.once("c_created_curation", cb);
		},
		add_comment: function(content, id, cb) {
			client.emit("c_add_comment", {
				uid: loggedin.uid,
				cid: client.id,
				auth: loggedin.username,
				content: content,
				id: id
			});
			client.once("c_added_comment", function(res) {
				cb(res);
			});
		},
		get_self: function(cb) {
			if (loggedin.uid && token) {
				client.emit("c_get_self", {
					cid: client.id,
					token: token
				});
				client.once("c_got_self", function(me) {
					cb(me);
				});
			}
		},
		get_favorites: function get_favorites(cb) {
			if (loggedin.uid && token) {
				client.emit("c_get_favorites", {
					cid: client.id,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_got_favorites", function(favs) {
					cb(favs)

				});
			} else {
				console.log("not logged in");
			}
		},

		createUser: function createUser(username, password, cb) {
			if (!loggedin.uid) {
				client.emit("c_create_user", {
					cid: client.id,
					username: username,
					password: password
				});
				client.once("c_created_user", function(res) {
					cb(res);
				});
			}
		},

		follow_tag: function follow_tag(tag, cb) {
			if (loggedin.uid && token) {
				client.emit("c_follow_tag", {
					cid: client.id,
					tag: tag,
					token: token,
					uid: loggedin.uid
				});
				console.log("c_followed_tag_" + tag);
				console.log(client.id);
				client.once("c_followed_tag_" + tag, function(res) {
					console.log("FJSAFJ");
					cb(res);
				});
			}
		},
		follow_cur: function(cur, cb)

		{
			client.emit("c_follow_cur", {
				cid:client.id,
				cur:cur,
				token:token,
				uid:loggedin.uid
			});
			client.once("c_follow_cur_"+cur, cb);

		},
		unfollow_cur:function(cur, cb){
			client.emit("c_unfollow_cur", {
				cid:client.id,
				cur:cur,
				token:token,
				uid:loggedin.uid
			});
			client.once("c_unfollow_cur_"+cur, cb);
		},
		unfollow: function(tag, cb) {
			if (loggedin.uid && token) {
				client.emit("c_unfollow", {
					cid: client.id,
					tag: tag,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_unfollowed_" + tag, function(res) {
					cb(res)
				});
			}
		},
		add_favorite: function add_favorite(pid, cb) {
			if (loggedin.uid && token) {
				console.log("Emitting");
				client.emit("c_add_favorite", {
					cid: client.id,
					pid: pid,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_added_favorite_" + pid, function(res) {
					cb(res);
				});
			}
		},
		unfavorite: function(pid, cb) {
			if (loggedin.uid && token) {
				client.emit("c_unfavorite", {
					cid: client.id,
					pid: pid,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_unfavorited_" + pid, function(res) {
					cb(res);
					console.log("RECEIEVED");
				});
			}
		},
		get_cur_posts: function(cur, cb, count){
			if (!count) {
				count = 10;
			}
			var time = Date.now();
			client.emit("c_get_cur_posts", {
				cid:client.id,
				count:count,
				cur:cur,
				time:time
			});
			;
			client.once("c_got_cur_posts_"+cur+"_"+time,function(posts){
				console.log("RES FROM SERVER");
				cb(posts)
			});
		},
		get_feed: function get_feed(cb, count) {
			if (!count) {
				console.log("DEFAULTS");
				var need = cur.tags.length;
				count = 10;
			}
			client.emit("c_get_feed", {
				cid: client.id,
				count: count
			});
			console.log("c_got_feed_" + loggedin.uid);
			client.once("c_got_feed_" + loggedin.uid, function(posts) {

				console.log(posts);
				cb(posts);
			});
		},
		get_by_id: function(id, cb) {
			client.emit("c_get_post_by_id", {
				cid: client.id,
				pid: id
			});
			client.once("c_got_post_by_id", cb);
		},
		attempt_token: function attempt_token(token, cb) {
			client.emit("c_token_login", {
				token: token,
				cid: client.id
			});
			console.log("emitted");
			client.once("c_token_logged_in", function(res) {
				console.log(res);
				if (res) {
					login();
					set_username(res.username);
					//notify("Welcome back, " + res.username);
				} else {
					localStorage.removeItem("auth_token");
					window.location.href = "/login.html";
				}
				cb(res);
			});
		},

		create_post: function create_post(title, content, tags, cb) {
			client.emit("c_create_post", {
				title: title,
				content: content,
				auth: loggedin.username,
				tags: tags,
				uid: loggedin.uid,
				cid: client.id
			});
			client.once("c_created_post", function(results) {
				cb(results);

			});
		},
		get_top: function(cb, count) {
			var posts = {};
			if (!count) {
				var count = 10;
			}
			client.emit("c_get_top", {
				filter: "top",
				count: count,
				id: client.id
			});
			client.once("c_got_top", function(posts) {
				cb(posts.posts);
			});
		},
		change_username: function(username, cb) {
			client.emit("c_change_username", {
				cid: client.id,
				token: token,
				new_u: username
			});
			client.once("c_changed_username", cb);
		},
		get_posts: function get_posts(filter, data, cb, count) {
			if (!count) {
				count = 10;
			}
			var posts = {};
			client.emit("c_get_posts", {
				filter: filter,
				count: count,
				id: client.id,
				data: data
			});
			client.once("c_got_posts_" + data, function(results) {
				Object.keys(results.posts).forEach(function(key) {
					posts[key] = results.posts[key];
				});
				cb(posts);
			});

		}
	}

	function notify(text) {
		var notif = document.createElement("div");
		notif.className = "notification";
		notify.innerHTML = text;
		document.getElementById("notifications").appendChild(notif);
		if (!("Notification" in window)) {} else if (Notification.permission === "granted") {
			var notification = new Notification(text);
			setTimeout(notification.close.bind(notification), 5000);


		} else if (Notification.permission !== "denied") {
			Notification.requestPermission(function(permission) {
				if (permission === "granted") {
					var notification = new Notification(text);
					setTimeout(notification.close.bind(notification), 5000);
				}
			});
		}
	}

	function show_comments(post) {
		var overlay = document.getElementById("overlay");
		overlay.style.display = "block";
		document.getElementById("comment-title").innerHTML = post.title;
		var commentsCon = document.getElementById("comments-list");
		removeFrom(commentsCon);
		cur_com = post.id;
		console.log(post);
		post.comments.forEach(function(comment) {
			var el = document.createElement("li");
			el.className = "comment";
			el.innerHTML = comment.content;
			var au = document.createElement("span");
			au.className = "comment-author";
			au.innerHTML = comment.auth;
			el.appendChild(au);
			commentsCon.appendChild(el);

		});
	}
	function checkUrl(url){
		var res = /(https*:\/\/\S+\.\S+)/
		var is = url.match(res);
		if(is){
			console.log("RETURNING URL");
			return {res:is, un: url.replace(res, "")}
		} else {
			return  false;
		}
	}
	function checkImage(url) {
		var re = /https*:\/\/\S+\.\S+\.(jpg|png|gif)/;
		var res = re.exec(url)
		if (res) {
			return (res.length > 1);
		} else {
			return false;
		}
	}

	function hide_comments() {
		var overlay = document.getElementById("overlay");
		overlay.style.display = "none";
		chain.get_by_id(cur_com, function(post) {

			var posts = document.getElementsByClassName("post");
			for (var i = 0; i < posts.length; i++) {
				if (posts.item(i).getElementsByClassName("post-id").item(0).innerHTML.trim() == cur_com.trim()) {
					console.log("Found!");
					posts.item(i).getElementsByClassName("comment-post").item(0).innerHTML = "Comments: " + post.comments.length;
					break;
				}
			}
		});
	}
	function replLinks(cont, rmfirst){
		var done = 0;
		var res = /(https*:\/\/\S+\.\S+)/

		var is = cont.replace(res, function(match){
			if(rmfirst && done === 0){
				done = 1;
				return "";
			} else {
				return "<a href='"+match+"'>"+match+"</a>"
			}
		});
		if(is){
			return is
		} else {
			return  "";
		}
	}


	function makePost(post) {
		if (!post.title) {
			return;
		}
		console.log(post);
		var postt = document.createElement("div");
		postt.className = "post";
		var title = document.createElement("div");
		title.className = "post-title";
		title.innerHTML = post.title + " - " + post.favs;
		var auth = document.createElement("div");
		auth.className = "post-auth";
		auth.innerHTML = "by " + post.auth;
		if (post.content) {
			var e = checkUrl(post.content.trim());
			var res = e.res;
			var img;
			if (res) {
				console.log("URLRL");
				var imgC = checkImage(res[0]);
				if(imgC){
					img = document.createElement("img");
					img.src = res[0];
					console.log("IT'S A MEME");
					img.className = "post-image";
					res.shift();
				}
			}
			var yes = false;
			if(imgC){
				yes = true;
			}

			var links = replLinks(post.content, yes);
			if(!links){
				links = "";
			}
			var content = document.createElement("div");
			content.className = "post-content";
			content.innerHTML = links;
			if(img){
				content.appendChild(img);
			}
		}
		var bar = document.createElement("div");
		bar.className = "post-bar";
		var tags = document.createElement("div");
		tags.className = "post-tags";
		post.tags.forEach(function(tag) {
			var button = document.createElement("button");
			button.className = "tag";
			button.type = "button";
			button.innerHTML = tag;
			button.addEventListener("click", function(e) {
				findByTag(tag);
			});
			tags.appendChild(button);
		});
		bar.appendChild(tags);
		var buttons = document.createElement("div");
		buttons.className = "post-buttons";
		var fav = document.createElement("button");
		fav.className = "fav-post";
		fav.type = "button";
		var comments = document.createElement("button");
		comments.className = "comment-post";
		comments.type = "button";
		comments.innerHTML = "Comments: " + post.comments.length;
		comments.addEventListener("click", function(e) {
			prevent(e)
			chain.get_by_id(post.id, function(post) {
				show_comments(post);
			});
		});
		if (post.favorited == true) {
			fav.innerHTML = "Unfavorite"
			fav.addEventListener("click", function(e) {
				prevent(e);
				chain.unfavorite(e.target.parentNode.parentNode.parentNode.getElementsByClassName("post-id").item(0).innerHTML, function(res) {
					reloadCur();
				});

			});
		} else {
			console.log(post);
			fav.innerHTML = "Favorite"
			fav.addEventListener("click", function(e) {
				prevent(e);
				console.log("Favoriting");
				chain.add_favorite(e.target.parentNode.parentNode.parentNode.getElementsByClassName("post-id").item(0).innerHTML, function(res) {
					reloadCur();
				});

			});
		}
		buttons.appendChild(comments);
		buttons.appendChild(fav);
		bar.appendChild(buttons);
		var id = document.createElement("div");
		id.className = "post-id";
		id.innerHTML = post.id+"<br>"+post.date;
		postt.appendChild(title);
		postt.appendChild(auth);
		if (post.content) {
			postt.appendChild(content);
		}
		postt.appendChild(bar);
		postt.appendChild(id);
		return postt;
	}

	function show_post(post, toAppend) {
		var made = makePost(post);
		if (made) {
			toAppend.appendChild(made);
		}
	}

	function set_username(username) {
		var us = document.getElementsByClassName("username");
		for (var i = 0; i < us.length; i++) {
			console.log("set");
			us.item(i).innerHTML = username;
		}
	}

	function makeLoad(toAppend, cb) {
		var load = document.createElement("div");
		load.className = "load";
		var button = document.createElement("button");
		button.className = "load-button";
		button.innerHTML = "Load More";
		button.addEventListener("click", function(e) {
			cb(load, e);
		});
		load.appendChild(button);
		toAppend.appendChild(load);
	}

	function makeFake(text) {
		var fake = document.createElement("div");
		fake.className = "fake-post";
		fake.innerHTML = text;
		return fake;
	}
	var mains = {
		"home": function() {
			home_num = 20;
			var max = 0;
			removeFrom(document.getElementById("home"));
			chain.get_top(function(posts) {
				console.log(posts);
				var sorted = Object.keys(posts).sort(function(post1, post2) {
					if (posts[post1].favs > posts[post2].favs) {
						return -1;
					} else if (posts[post1].favs < posts[post2].favs) {
						return 1;
					} else {
						return 0;
					}

				})
				sorted.forEach(function(key) {
					var post = posts[key];

					console.log(post);
					if (post.title) {
						show_post(post, document.getElementById("home"));
					}

				});
				max = sorted.length
				if (sorted.length >= 10) {
					makeLoad(document.getElementById("home"), function(load) {
						console.log("LOADING MORE OF " + home_num)
						chain.get_top(function(posts) {
							console.log(posts);
							var sorted = Object.keys(posts).sort(function(post1, post2) {
								if (posts[post1].favs > posts[post2].favs) {
									return -1;
								} else if (posts[post1].favs < posts[post2].favs) {
									return 1;
								} else {
									return 0;
								}

							});
							console.log(sorted);
							sorted.splice(0, max)
							console.log("SPLICED:");
							console.log(sorted);

							sorted.forEach(function(key) {
								var post = posts[key];
								console.log(key);
								console.log(post);
								if (post.title) {
									document.getElementById("home").insertBefore(makePost(post), load);
								}

							});
							max += sorted.length;
							home_num += 20;


						}, home_num + 20);
					});
				}
			}, 40);
		},
		"curations": function() {
			removeFrom(document.getElementById("fol-curs"));
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch your followed curations";
			document.getElementById("fol-curs").appendChild(li);

			chain.get_self(function(me){
				removeFrom(document.getElementById("fol-curs"));
				var arr = Object.keys(me.curs);
				arr = arr.filter(function(item){ if(me.curs[item] === true){ return true} else {return false}});
				arr.forEach(function(cur){
					var li = document.createElement("li");
					li.innerHTML = cur;
					li.addEventListener("click", function(e){
						findByCuration(cur);
					});
					document.getElementById("fol-curs").appendChild(li);
				});
				if(arr.length == 0){
					var li = document.createElement("li");
					li.innerHTML = "You're not following any curations!";
					document.getElementById("fol-curs").appendChild(li);

				}
			});

		},
		"search": function() {
			removeFrom(document.getElementById("your-tags"));
			removeFrom(document.getElementById("pop-tags"));
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch your followed tags";
			document.getElementById("your-tags").appendChild(li);
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch popular tags";
			document.getElementById("pop-tags").appendChild(li);
			chain.get_self(function(me) {
				removeFrom(document.getElementById("your-tags"));
				Object.keys(me.tags).forEach(function(tag) {
					if (me.tags[tag] == true) {
						var li = document.createElement("li");
						li.innerHTML = tag;
						document.getElementById("your-tags").appendChild(li);
					} else {

					}
				});
				if (Object.keys(me.tags).length == 0) {
					var li = document.createElement("li");
					li.innerHTML = "You're not following anything!";
					document.getElementById("your-tags").appendChild(li);

				}
			});
			chain.get_top(function(posts) {
				removeFrom(document.getElementById("pop-tags"));
				var tags = {};
				console.log(posts);
				Object.keys(posts).forEach(function(key) {
					var post = posts[key]
					console.log(post);
					if (post.tags) {
						post.tags.forEach(function(tag) {
							if (tags[tag] == undefined) {
								tags[tag] = 0;

							}
							console.log(post);
							tags[tag] += post.favs
						});
					}
				});
				console.log(tags);
				var fin = Object.keys(tags).sort(function(tag1, tag2) {
					if (tags[tag1] > tags[tag2]) {
						return -1;
					} else if (tags[tag1] < tags[tag2]) {
						return 1;
					} else {
						return 0;
					}
				}).splice(0, 5);

				console.log(fin)
				fin.forEach(function(tag) {
					var li = document.createElement("li");
					li.innerHTML = tag;
					document.getElementById("pop-tags").appendChild(li);
				});
			});

		},
		"settings": function() {
			document.getElementById('username-form').value = loggedin.username;

		},
		"pop": function() {},
		"manage": function() {
			var def = document.createElement("li");
			def.innerHTML = "You don't own any curations!";
			document.getElementById("owned-curs").appendChild(def);
			chain.get_self(function(me){
				removeFrom(document.getElementById("owned-curs"));
				Object.keys(me.curations_owned).forEach(function(key){
					var li = document.createElement("li");
					li.innerHTML = key;
					li.addEventListener("click", function(){
						findByCuration(key);
					});
					document.getElementById("owned-curs").appendChild(li);
				});
			});

		},
		"favs": function() {
			removeFrom(document.getElementById("fav"));
			document.getElementById("fav").appendChild(makeFake("No favorited posts!"));
			chain.get_favorites(function(favs) {
				removeFrom(document.getElementById("fav"));
				favs.forEach(function(fav) {
					fav.favorited = true;
					show_post(fav, document.getElementById("fav"));
				});
				if (favs.length == 0) {
					document.getElementById("fav").appendChild(makeFake("No favorited posts!"));

				}
			});

		},
		"feed": function(that) {
			var max_feed = 20;
			var postI = document.getElementById("posts");
			removeFrom(postI);
			var coll = {};
			var max = 0;
			postI.appendChild(makeFake("No found posts!"));
			//	setTimeout(function() {
			chain.get_feed(function(posts) {
				removeFrom(postI);
				Object.keys(posts).forEach(function(key) {
					coll[key] = true;
					show_post(posts[key], postI);
				});
				max += Object.keys(posts).length;

				if (Object.keys(posts).length == 0) {
					postI.appendChild(makeFake("No found posts!"));
				}
				if (Object.keys(posts).length >= 10) {
					makeLoad(postI, function(load) {
						console.log("getting");
						chain.get_feed(function(posts2) {
							var arr = Object.keys(posts2);
							console.log(posts2);
							console.log("_");
							console.log(posts);
							arr.forEach(function(key) {
								if (coll[key]) {
									console.log(key);
								} else {
									max++;
									console.log("DISPLAYING");
									coll[key] = true;
									postI.insertBefore(makePost(posts2[key]), load);
								}
							});
							max_feed += 20;
						}, max_feed + 20);
					});
				}
			}, 20);
			//}, 20);
		}
	}
	Object.keys(mains).forEach(function(key, index) {
		mains[key] = {
			id: key,
			el: document.getElementById(key),
			ref: mains[key]
		}
	});

	function reloadCur() {
		console.log("reloading current page");
		showblocking(cur_show);
	}

	function logout() {
		var ls = document.getElementsByClassName("loggedout");
		var li = document.getElementsByClassName("loggedin");
		for (var i = 0; i < ls.length; i++) {
			ls.item(i).style.display = 'block';
		}
		for (var i = 0; i < li.length; i++) {
			li.item(i).style.display = 'none';
		}
	}

	function login() {
		var ls = document.getElementsByClassName("loggedin");
		var li = document.getElementsByClassName("loggedout");
		for (var i = 0; i < ls.length; i++) {
			ls.item(i).style.display = 'block';
		}
		for (var i = 0; i < li.length; i++) {
			li.item(i).style.display = 'none';
		}
	}
	var showblocking = function(toshow) {
		Object.keys(mains).forEach(function(key) {
			var main = mains[key];
			if (key.trim() == toshow.trim()) {
				if (main.ref) {
					main.ref(main);
				}
				main.el.style.display = "block";
				console.log("Shown");
			} else {
				main.el.style.display = "none";
			}
			console.log(main.el.id + " " +
				toshow);
		});
		console.log(document.getElementById("results").style)
		document.getElementById("results").style.display = "none";
		removeFrom(document.getElementById("results-posts"));
		console.log(document.getElementById("results").style)
		cur_show = toshow;
	}

	function hideall() {

		Object.keys(mains).forEach(function(key) {
			console.log(key);
			document.getElementById(key).style.display = "none";
		});
	}
	document.getElementById("navbar").addEventListener("click", function(e) {
		if (e.target.tagName.toLowerCase() == "a") {

			var tar = e.target.attributes.href.value.slice(1);
			console.log(tar);
			showblocking(tar);
		}
	});

	function removeFrom(feed) {
		while (feed.hasChildNodes()) {
			feed.removeChild(feed.lastChild);
		}
	}
	function dispRule(rule, cb, span){
		var desc = "";
		switch(rule.type){
			case "not_u":
				desc = "Exclude user <strong>"+ rule.value+"</strong>";
				break;
			case "yes_u":
				desc = "Include user <strong>" + rule.value+"</strong>";
				break;
			case "yes_string":
				desc = "Include posts containing <strong>"+rule.value+"</strong>";
				break;
			case "no_string":
				desc = "Exclude posts containing <strong>"+rule.value+"</strong>";
				break;
			default:
				return;
				break;
		}
		if(span)
		{
			return desc;
		}
		var el = document.createElement("li");
		el.className = "currule";
		el.innerHTML = desc+ " ";
		var but = document.createElement("button");
		but.className = "curbutx";
		but.innerHTML = "X";
		but.addEventListener("click", function(e){
			e.target.parentNode.remove();
			cb(e);
		});
		el.appendChild(but);
		return el;


	}
	function findByCuration(cur){
		var max_res = 20;
		var coll = {};
		var max = 0;
		chain.get_cur_posts(cur, function(posts){
			console.log("CUR POSTS CALLED");
			removeFrom(document.getElementById("results-posts"));
			removeFrom(document.getElementById("cur-mod-tags-list"));
			document.getElementById("results").style.display = "block";
			hideall();
			Object.keys(posts).forEach(function(key){
				var post = posts[key];
				coll[key] = true;
				max++;
				console.log("CUR:");
				console.log(posts);
				show_post(post, document.getElementById("results-posts"));
			});
			if(Object.keys(posts).length >= 10){
				makeLoad(document.getElementById("results-posts"), function(load){
					chain.get_cur_posts(cur, function(posts2){
						var arr = Object.keys(posts2);
						arr.forEach(function(key){
							if(coll[key]){

							} else {
								max++;
								coll[key] = true;
								document.getElementById("results-posts").insertBefore(makePost(posts2[key]), load);
							}
						});
						max_res+=20;
					},max_res+20);
				});

			}
			chain.get_self(function(me){
				if(me.curs[cur] === true){

				}
				if(me.curations_owned[cur] === true){
					document.getElementById("cur-mod").style.display = "block";
					chain.get_cur_mod(cur, function(res){
						if(res){

							res.tags.forEach(function(tag, index){
								document.getElementById("cur-mod-tags-list").appendChild(createTagDiv(tag, function(v){
									res.tags.splice(index, 1);
									chain.edit_cur_mod(cur, res, function(res){

										findByCuration(cur);
										notify("That tag is no longer in the curation "+cur+" !");
									});
								}));
							});
							if(Object.keys(res.rules).length > 0){
								removeFrom(document.getElementById("cur-rules-list"))
								Object.keys(res.rules).forEach(function(key, index){
									var rule = res.rules[key];
									var el = dispRule(rule, function(e){
										delete res.rules[key];
										chain.edit_cur_mod(cur, res, function(res){

											findByCuration(cur);
											notify("That rule has been removed from the curation "+cur+" !");
										});
									})

									document.getElementById("cur-rules-list").appendChild(el);
								});
							}
						} else {
							alert("Something went wrong!");
						}
					});
				} else {
					document.getElementById("cur-mod").style.display = "none";
				}
			});
			resCur = true;
			resultsTag = cur;

			checkRes();
		}, 20);
	}
	function createTagDiv(tag, cb){
		var toAdd = document.createElement("a");
		toAdd.style['font-size'] = "small";
		toAdd.className = "curtag";
		toAdd.innerHTML = tag + " ";
		var remove = document.createElement("button");
		remove.innerHTML = 'X';
		remove.type = "button";
		remove.className = "create-remove";
		remove.addEventListener("click", function(e) {
			e.target.parentNode.remove();
			cb(tag);
		});
		toAdd.appendChild(remove);
		return toAdd;
	}
	function findByTag(tag) {

		var max_res = 20;
		var coll = {};
		var max = 0
		console.log("trigged tag");
		chain.get_posts("tag", [tag], function(posts) {
			removeFrom(document.getElementById("results-posts"));
			console.log(":TUREND ON RESULTS");
			document.getElementById("results").style.display = "block";
			hideall();
			console.log(posts);
			Object.keys(posts).forEach(function(key) {
				var post = posts[key];
				coll[key] = true;
				max++;
				show_post(post, document.getElementById("results-posts"));
			});
			if (Object.keys(posts).length >= 10) {
				makeLoad(document.getElementById("results-posts"), function(load) {
					chain.get_posts("tag", [tag], function(posts2) {
						var arr = Object.keys(posts2);
						arr.forEach(function(key) {
							if (coll[key]) {
								console.log(key);
							} else {
								max++;
								console.log("DISPLAYING");
								coll[key] = true;
								document.getElementById("results-posts").insertBefore(makePost(posts2[key]), load);
							}
						});
						max_res += 20;

					}, max_res + 20);
				});
			}
			resultsTag = tag;
			resCur = false;
			console.log("TOTAL TAG: ") + tag;
			checkRes();
		}, 20);

	}

	function checkRes() {
		console.log("checking");
		var follow = document.getElementById("results-follow");
		var unfollow = document.getElementById("results-unfollow");
		if(resCur){

			document.getElementById("results-cur").style.display = "block";
			document.getElementById("results-tag").style.display = "none";
			document.getElementById('cur-span').innerHTML = resultsTag;
			follow = document.getElementById("results-cur-follow");
			unfollow = document.getElementById("results-cur-unfollow");
		} else {
			document.getElementById("cur-mod").style.display  = "none";
			document.getElementById("results-cur").style.display = "none";
			document.getElementById("results-tag").style.display = "block";
			document.getElementById("results-span").innerHTML = resultsTag;
		}
		chain.get_self(function(me) {
			var yes = false;
			if(resCur){
				if(me.curs[resultsTag] === true){
					yes = true;
					follow.style.display  = "none";
					unfollow.style.display = "block";

				}
			} else {
				Object.keys(me.tags).forEach(function(tag) {
					if (me.tags[tag] == true && tag == resultsTag) {
						console.log(tag);
						console.log(me.tags);
						console.log("FAFS");
						follow.style.display = "none";
						unfollow.style.display = "block";
						yes = true;

					}
				});
			}
			if (!yes) {
				unfollow.style.display = "none";
				follow.style.display = "block";
			}
		});
	}
	client.on('connect', function() {
		console.log("connected");
		if (token) {
			chain.attempt_token(token, function(res) {
				if (res) {
					loggedin.username = res.username;
					loggedin.uid = res.uid;
					loggedin.email = res.email;
					console.log(res);
				} else {
					window.location.href = "./login.html";
				}
				mains["feed"].ref();
				if (window.location.href.split("#")[1]) {

					showblocking(window.location.href.split("#")[1]);
				} else {
					showblocking("home");
				}
			});
			document.getElementById("comment").addEventListener("submit", function(e) {
				prevent(e);
				var content = e.target.elements.content.value;
				e.target.reset();
				chain.add_comment(content, cur_com, function(res) {
					chain.get_by_id(cur_com, function(post) {
						console.log(post);
						show_comments(post);
					});
				});
			});
			document.getElementById("create-post").addEventListener("submit", function(e) {
				prevent(e);
				var title = e.target.title.value;
				var content = e.target.content.value;
				var tags = [];
				var t = document.getElementsByClassName("create-tags")
				for (var i = 0; i < t.length; i++) {
					tags.push(t.item(i).innerHTML.split("<")[0].trim());
				}
				tags.filter(function(tag){
					if(tag.length <= 20){
						return true;
					} else {
						return false;
						notify("Tag "+tag+ " is too long and was removed!");
					}
				});
				removeFrom(document.getElementById("create-already-tags"));
				chain.create_post(title, content, tags, function(res) {
					if (res) {
						window.location.hash = "#home";
						showblocking('home');
					} else {
						alert("You've been making too many posts recently. Cut it out for a while!");
					}
				});
				e.target.reset();


			});
			document.getElementById("add-rules").type.addEventListener("change", function(e){
				document.getElementById("rules-desc").innerHTML = dispRule({type:document.getElementById("add-rules").type.value,value:""},null,true)+":";
			});
			document.getElementById("add-rules").addEventListener("submit", function(e){
				prevent(e);
				var val = e.target.string.value;
				var rule = e.target.type.value;
				if(val){
					e.target.reset();
					chain.get_cur_mod(resultsTag, function(res){
						var key = rule+"_"+val;
						if(res.rules[key]){
							notify("That rule is already added to this curation!");
						} else {
							res.rules[key] = {
								type:rule,
								value:val
							}
							chain.edit_cur_mod(resultsTag, res, function(res){
								if(res){
									notify("Rule successfully added!");
									findByCuration(resultsTag);
								} else {
									notify("Could not add rule");
								}
							});
						}
					});
				} else {
					notify("Not a complete rule!");
				}
			});
			document.getElementById("tags-seperator").addEventListener("click", function(e) {
				if (e.target.tagName.toLowerCase() == "li") {
					findByTag(e.target.innerHTML);
				}
			});
			document.getElementById("logout").addEventListener("click", function(e) {
				logout()
				localStorage.removeItem("auth_token");
				location.reload();
			});
			document.getElementById("createformtags").addEventListener("submit", function(e) {
				if (e.target.tag.value.trim()) {
					var toAdd = document.createElement("a");
					toAdd.style['font-size'] = "small";
					toAdd.className = "create-tags";
					toAdd.innerHTML = e.target.tag.value + " ";
					var remove = document.createElement("button");
					remove.innerHTML = 'X';
					remove.type = "button";
					remove.className = "create-remove";
					remove.addEventListener("click", function(e) {
						e.target.parentNode.remove();
					});
					toAdd.appendChild(remove);
					document.getElementById("create-already-tags").appendChild(toAdd);
					e.target.reset();
					prevent(e);
				}

			});
			document.getElementById("cur-tags-form").addEventListener("submit", function(e) {
				if (e.target.tag.value.trim()) {

					document.getElementById("toaddcur").appendChild(createTagDiv(e.target.tag.value.trim(), function(){}));
					prevent(e);
					e.target.reset();
				}
			});
			document.getElementById("create-cur").addEventListener("submit", function(e){
				prevent(e);
				var name = e.target.elements.curname.value.trim();
				var tags = [];
				var t = document.getElementsByClassName("curtag")
				for (var i = 0; i < t.length; i++) {
					tags.push(t.item(i).innerHTML.split("<")[0].trim());
				}
				removeFrom(document.getElementById("toaddcur"));
				if(name && tags.length){

					chain.create_curation(name, tags, function(res){
						if(res === true){
							notify("Curation created!");
							showblocking("manage");
						} else {
							if(res === "already"){
								alert("There's already a curation named that!");
							}
						}
					});
				} else {
					alert("Your curation needs to start with a name and at least one tag");
				}

			});
			document.getElementById("createmodtag").addEventListener("submit", function(e){
				prevent(e);
				var tag = e.target.tag.value;
				if(tag){
					e.target.reset();
					chain.get_cur_mod(resultsTag, function(res){
						if(res){
							if(res.tags.indexOf(tag) !== -1){
								notify("Tag already added!");
							} else {
								document.getElementById("cur-mod-tags-list").appendChild(createTagDiv(tag, function(){
									chain.get_cur_mod(resultsTag, function(res){
										res.tags.splice(res.tags.indexOf(tag), 1);
										chain.edit_cur_mod(resultsTag, res, function(res){
											findByCuration(resultsTag);
											notify("Tag removed from curation!");
										});
									});
								}));
								res.tags.push(tag)
								chain.edit_cur_mod(resultsTag, res, function(res){
									findByCuration(resultsTag);
									notify("Tag added to curation!");
								});


							}
						}
					});
				}
			});
			document.getElementById("settings-email").addEventListener("submit", function(e){
				prevent(e);
				var email = e.target.elements.email.value;
				chain.change_email(email, function(res){
					if(res){
						e.target.reset();
						notify("Email changed!");
					} else {
						notify("Could not change email. Maybe someone else has that email?");
					}
				});
			});
			document.getElementById("find-tag").addEventListener("submit", function(e) {
				prevent(e);
				var data = e.target.elements.tag.value;
				findByTag(data);
			});
			document.getElementById("results-follow").addEventListener("click", function(e) {
				if (resultsTag !== false) {
					chain.follow_tag(resultsTag, function() {
						notify("Followed " + resultsTag);
						checkRes()

					});
				}
			});
			document.getElementById("results-cur-follow").addEventListener("click", function(e){
				if(resultsTag !== false){
					chain.follow_cur(resultsTag, function(){
						notify("Followed "+resultsTag);
						checkRes();
					});
				}
			});
			document.getElementById("find-curation").addEventListener("submit", function(e){
				prevent(e);
				findByCuration(e.target.cur.value.trim());
			});
			document.getElementById("settings-name").addEventListener("submit", function(e) {
				prevent(e);
				chain.change_username(e.target.elements.username.value, function(res) {
					if (res) {
						localStorage.removeItem("auth_token");

						alert("For security reasons, you must log back in after changing your username.");
						window.location.href = "/login.html";
					} else {
						alert("Couldn't change username");
					}
				});
			});
			document.getElementById("overlay-background").addEventListener("click", function(e) {
				hide_comments();

			});
			document.getElementById("results-unfollow").addEventListener("click", function(e) {
				if (resultsTag !== false) {
					chain.unfollow(resultsTag, function() {
						notify("Unfollowed " + resultsTag);
						checkRes()
					});
				}
			});
			document.getElementById("results-cur-unfollow").addEventListener("click", function(e){
				if(resultsTag !== false){
					chain.unfollow_cur(resultsTag, function(){
						notify("Unfollowed "+resultsTag);
						checkRes();
					});
				}
			});

		} else {
			window.location = "/login.html";

		}
	});
}
