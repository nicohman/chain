window.onload = function () {
	var client = io("https://demenses.net:3000", {
		secure: true
	});
	Muuri.defaultOptions.layout = {
		fillGaps: true,
		rounding: false
	}
	Muuri.defaultOptions.layoutDuration = 0;
	var loggedin = {};
	var resultsTag;
	var homePage = new Muuri(document.getElementById("home"), {});
	var feedPage = new Muuri(document.getElementById("posts"), {});
	var resultsPage = new Muuri(document.getElementById("results-posts"), {});
	var favGrid = new Muuri(document.getElementById("fav"), {});
	var ownPage = new Muuri(document.getElementById("own"), {});
	var home_num = 10;
	var cur_show = "home";
	var resCur = false;
	var bigPost = "";
	var curBig = false;
	var useYt = false;

	function removeGrid(grid) {
		var its = grid.getItems();
		if (its) {
			its = its.filter(function (x) {
				if (x._element.parentNode) {
					return true;
				} else {
					return false;
				}
			});
			grid.remove(its, {
				removeElements: true
			});
		}
	}
	var enDub = false;
	var pdate = function (posts) {
		return function (p1, p2) {
			if (posts[p1].date > posts[p2].date) {
				return -1;
			} else if (posts[p1].date < posts[p2].date) {
				return 1;
			} else {
				return 0;
			}
		}
	}

	function getParameter(name) {
		return decodeURIComponent((new RegExp('[?|&]' + name + '=' +
			'([^&;]+?)(&|#|;|$)').exec(window.location) || [null, ''])[1].replace(
			/\+/g, '%20')) || null;
	}

	function prevent(e) {
		if (e.preventDefault) {
			e.preventDefault();
		} else {
			e.returnValue = false;
		}
	}

	function checkCustSet(set) {
		var lS = {};
		if (set) {
			lS = set;
		} else if (localStorage.getItem("customcolorscheme")) {
			lS = JSON.parse(localStorage.getItem("customcolorscheme"));
		}
		var csFormE = document.getElementById("cust-cs-form").elements;
		if (!lS.text) {
			lS["main-bg"] = "#?????";
			lS["sec-bg"] = "#?????";
			lS["border"] = "#?????";
			lS["text"] = "#?????";
			lS["follow"] = "#?????";
		}
		csFormE["main-bg"].value = lS["main-bg"];
		csFormE["sec-bg"].value = lS["sec-bg"];
		csFormE.border.value = lS.border;
		csFormE.text.value = lS.text;
		csFormE.follow.value = lS.follow;
	}

	function checkVisCust() {
		if (document.getElementById("cs-form").elements["cs-select"].value ===
			"custom") {
			document.getElementById("cust-cs").style.display = "block";
		} else {
			document.getElementById("cust-cs").style.display = "none";
		}
	}
	checkVisCust();
	Object.keys(schemes).forEach(function (scheme) {
		if (scheme !== "cust-cs") {
			var sel = document.createElement("option");
			sel.value = scheme;
			sel.innerHTML = scheme;
			document.getElementById("cs-select").appendChild(sel);
		}
	});
	var custSel = document.createElement("option");
	custSel.innerHTML = "custom";
	custSel.value = "custom";
	custSel.id = "cust-sel";
	document.getElementById("cs-select").appendChild(custSel);
	document.getElementById("cs-form").addEventListener("submit", function (e) {
		prevent(e);
		localStorage.setItem("colorscheme", e.target["cs-select"].value)
		if (e.target["cs-select"].value === "custom") {
			var csFormE = document.getElementById("cust-cs-form").elements;
			localStorage.setItem("customcolorscheme", JSON.stringify({
				"main-bg": csFormE["main-bg"].value,
				"sec-bg": csFormE["sec-bg"].value,
				"border": csFormE.border.value,
				"text": csFormE.text.value,
				"follow": csFormE.follow.value
			}));
			checkCustSet();
			changeColorscheme("custom");
		} else {
			changeColorscheme(e.target["cs-select"].value);
		}
	});
	document.getElementById("cs-form").addEventListener("change", function () {
		checkVisCust();
	});
	checkCustSet();
	document.getElementById("yt-button").addEventListener("click", function () {
		localStorage.setItem("yt", !useYt);
		useYt = !useYt;
		checkYt();
	});
	function checkYt() {
		if (useYt) {
			document.getElementById("yt-button").innerHTML = "Disable youtube embeds";
		} else {
			document.getElementById("yt-button").innerHTML = "Enable youtube embeds";
		}
	}
	if (localStorage.getItem("yt")) {
		var got = localStorage.getItem("yt");
		switch (got) {
		case "false":
			useYt = false;
			break;
		case "true":
			useYt = true;
			break;
		}
	}
	checkYt();
	var cur_com = "";
	var token = localStorage.getItem("auth_token");
	var chain = {
		attempt_login: function attempt_login(uid, password, cb) {
			client.emit("c_login", {
				uid: uid,
				password: password,
				cid: client.id
			});
			client.once("c_logged_in_" + uid, function (newtoken) {
				if (newtoken) {
					token = newtoken
					localStorage.setItem("auth_token", newtoken);
					login();
				}
				cb(null, newtoken);
			});
		},
		get_cur_mod: function (cur, cb) {
			client.emit("c_get_cur_mod", {
				token: token,
				cid: client.id,
				cur: cur,
				uid: loggedin.uid
			});
			client.once("c_got_cur_mod_" + cur, function (res) {
				cb(res);
			});
		},
		change_email: function (email, cb) {
			client.emit("c_change_email", {
				token: token,
				uid: loggedin.uid,
				email: email,
				cid: client.id
			});
			client.once("c_changed_email", cb);
		},
		edit_cur_mod: function (cur, ed, cb) {
			client.emit("c_edit_cur_mod", {
				cur: cur,
				cid: client.id,
				uid: loggedin.uid,
				token: token,
				changes: ed
			});
			client.once("c_edited_cur_mod_" + cur, cb);
		},
		delete_post: function (pid, cb) {
			client.emit("c_delete_post", {
				pid: pid,
				uid: loggedin.uid,
				token: token,
				cid: client.id
			});
			client.once("c_deleted_post_" + pid, cb);
		},
		get_curation: function get_curation(id, cb) {
			client.emit("c_get_curation", {
				cid: client.id,
				id: id
			});
			client.once("c_got_curation_" + id, function (cur) {
				cb(cur);
			});
		},
		create_curation: function (name, tags, cb) {
			client.emit("c_create_curation", {
				cid: client.id,
				token: token,
				tags: tags,
				name: name
			});
			client.once("c_created_curation", cb);
		},
		get_notifs: function (cb) {
			client.emit("c_get_notifs", {
				cid: client.id,
				token: token
			});
			client.once("c_got_notifs", cb);
		},
		add_comment: function (content, id, cb) {
			client.emit("c_add_comment", {
				uid: loggedin.uid,
				cid: client.id,
				auth: loggedin.username,
				content: content,
				id: id,
				token: token
			});
			client.once("c_added_comment", function (res) {
				cb(res);
			});
		},
		change_color: function (email, color, cb) {
			client.emit("c_change_color", {
				uid: loggedin.uid,
				cid: client.id,
				color: color,
				email: email,
				token: token
			});
			client.once("c_changed_color", function (res) {
				cb(res);
			});
		},
		get_self_posts: function (cb) {
			client.emit("c_get_self_posts", {
				cid: client.id,
				token: token,
				count: 50
			});
			client.once("c_got_self_posts", cb);
		},
		get_self: function (cb) {
			if (loggedin.uid && token) {
				client.emit("c_get_self", {
					cid: client.id,
					token: token
				});
				client.once("c_got_self", function (me) {
					cb(me);
				});
			}
		},
		delete_curation: function (cur, cb) {
			client.emit("c_delete_curation", {
				cur: cur,
				cid: client.id,
				token: token
			});
			client.once("c_deleted_curation", function (res) {
				cb(res)
			});
		},
		get_favorites: function get_favorites(cb) {
			if (loggedin.uid && token) {
				client.emit("c_get_favorites", {
					cid: client.id,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_got_favorites", function (favs) {
					cb(favs)
				});
			}
		},
		rm_notif: function (id, cb) {
			client.emit("c_rm_notif", {
				cid: client.id,
				token: token,
				id: id
			});
			client.once("c_rmed_notif_" + id, cb);
		},
		createUser: function createUser(username, password, cb) {
			if (!loggedin.uid) {
				client.emit("c_create_user", {
					cid: client.id,
					username: username,
					password: password
				});
				client.once("c_created_user", function (res) {
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
				client.once("c_followed_tag_" + tag, function (res) {
					cb(res);
				});
			}
		},
		follow_cur: function (cur, cb) {
			client.emit("c_follow_cur", {
				cid: client.id,
				cur: cur,
				token: token,
				uid: loggedin.uid
			});
			client.once("c_follow_cur_" + cur, cb);
		},
		unfollow_cur: function (cur, cb) {
			client.emit("c_unfollow_cur", {
				cid: client.id,
				cur: cur,
				token: token,
				uid: loggedin.uid
			});
			client.once("c_unfollow_cur_" + cur, cb);
		},
		unfollow: function (tag, cb) {
			if (loggedin.uid && token) {
				client.emit("c_unfollow", {
					cid: client.id,
					tag: tag,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_unfollowed_" + tag, function (res) {
					cb(res)
				});
			}
		},
		add_favorite: function add_favorite(pid, cb) {
			if (loggedin.uid && token) {
				client.emit("c_add_favorite", {
					cid: client.id,
					pid: pid,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_added_favorite_" + pid, function (res) {
					cb(res);
				});
			}
		},
		unfavorite: function (pid, cb) {
			if (loggedin.uid && token) {
				client.emit("c_unfavorite", {
					cid: client.id,
					pid: pid,
					token: token,
					uid: loggedin.uid
				});
				client.once("c_unfavorited_" + pid, function (res) {
					cb(res);
				});
			}
		},
		get_cur_posts: function (cur, cb, count) {
			if (!count) {
				count = 10;
			}
			var time = Date.now();
			client.emit("c_get_cur_posts", {
				cid: client.id,
				count: count,
				cur: cur,
				time: time
			});
			client.once("c_got_cur_posts_" + cur + "_" + time, function (posts) {
				cb(posts)
			});
		},
		delete_comment: function (pid, cpos, cb) {
			client.emit("c_delete_comment", {
				token: token,
				pid: pid,
				cpos: cpos
			});
			client.once("c_deleted_comment_" + pid, cb);
		},
		get_curs_top: function (cb, count) {
			if (!count) {
				count = 10;
			}
			client.emit("c_get_curs_top", {
				cid: client.id,
				count: count
			});
			client.once("c_got_curs_top", function (res) {
				cb(res);
			});
		},
		get_feed: function get_feed(cb, count) {
			if (!count) {
				count = 10;
			}
			client.emit("c_get_feed", {
				cid: client.id,
				count: count
			});
			client.emit("c_get_feed", {
				cid: client.id,
				count: count
			});
			client.once("c_got_feed_" + loggedin.uid, function (posts) {
				cb(posts);
			});
		},
		get_by_id: function (id, cb) {
			client.emit("c_get_post_by_id", {
				cid: client.id,
				pid: id
			});
			client.once("c_got_post_by_id_" + id, cb);
		},
		sticky: function (pid, cb) {
			client.emit("c_sticky", {
				cid: client.id,
				token: token,
				pid: pid
			});
			client.once("c_stickied_" + pid, cb);
		},
		unsticky: function (pid, cb) {
			client.emit("c_unsticky", {
				token: token,
				cid: client.id,
				pid: pid
			});
			client.once("c_unstickied_" + pid, cb);
		},
		attempt_token: function attempt_token(token, cb) {
			client.emit("c_token_login", {
				token: token,
				cid: client.id
			});
			client.once("c_token_logged_in", function (res) {
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
			client.once("c_created_post", function (results) {
				cb(results);
			});
		},
		get_top: function (cb, count) {
			if (!count) {
				var count = 10;
			}
			client.emit("c_get_top", {
				filter: "top",
				count: count,
				id: client.id
			});
			client.once("c_got_top", function (posts) {
				cb(posts.posts);
			});
		},
		change_username: function (username, cb) {
			client.emit("c_change_username", {
				cid: client.id,
				token: token,
				new_u: username
			});
			client.once("c_changed_username", cb);
		},
		check_banned: function (uid, cb) {
			client.emit("c_check_ban", {
				cid: client.id,
				uid: uid
			});
			client.once("c_checked_ban_" + uid, cb);
		},
		ban: function (uid, cb) {
			client.emit("c_ban", {
				uid: uid,
				token: token,
				cid: client.id
			});
			client.once("c_banned_" + uid, cb);
		},
		unban: function (uid, cb) {
			client.emit("c_unban", {
				uid: uid,
				token: token,
				cid: client.id
			});
			client.once("c_unbanned_" + uid, cb);
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
			client.once("c_got_posts_" + data, function (results) {
				Object.keys(results.posts).forEach(function (key) {
					posts[key] = results.posts[key];
				});
				cb(posts);
			});
		}
	}

	function createComment(comment, post, commentsCon) {
		var el = document.createElement("li");
		el.className = "comment";
		var cont = onlyLinks(comment.content);
		el.innerHTML = cont;
		var au = document.createElement("span");
		au.className = "comment-author";
		var auT = comment.auth;
		if (comment.color) {
			auT = "<span style='color:" + comment.color + "'>" + comment.auth +
				"</span>";
		}
		var date = new Date(comment.date);
		auT += " | " + date.toDateString() + " " + date.toLocaleTimeString("en-US") +
			" | ";
		au.innerHTML = auT;
		if (loggedin.admin) {
			var del_com = document.createElement("button");
			del_com.className = "del-com niceinput";
			del_com.addEventListener("click", function () {
				var toind = post.comments.indexOf(comment);
				chain.delete_comment(post.id, toind, function (res) {
					if (res) {
						notify("Comment deleted!");
					} else {
						notify("Couldn't delete comment");
					}
				});
				chain.get_by_id(cur_com, function (post) {
					show_comments(post);
				});
			});
			del_com.innerHTML = "Delete"
			au.appendChild(del_com);
		}
		el.appendChild(au);
		commentsCon.appendChild(el);
	}

	function show_comments(post) {
		hide_big_post();
		var overlay = document.getElementById("overlay");
		overlay.style.display = "block";
		document.getElementById("comment-container").style.display = "flex";
		document.getElementById("comment-title").innerHTML = post.title;
		var commentsCon = document.getElementById("comments-list");
		removeFrom(commentsCon);
		cur_com = post.id;
		post.comments.filter(function (x) {
			return x != null
		}).forEach(function (comment) {
			createComment(comment, post, commentsCon);
		});
	}

	function upGrid(grid) {
		var eles = grid.getItems();
		eles.forEach(function (ele, ind) {
			var id = ele._element.children.item(0).children.item(4).innerHTML;
			if (id.length > 0) {
				chain.get_by_id(id, function (post) {
					if (post) {
						var madePost = makePost(post);
						grid.add(madePost);
						grid.remove(ele, {
							removeElements: true
						});
						grid.move(madePost, ind)
					} else {
						grid.remove(ele, {
							removeElements: true
						});
					}
				})
			}
		});
	}

	function checkUrl(url) {
		var res = /(https*:\/\/\S+\.\S+)/
		var is = url.match(res);
		if (is) {
			return {
				res: is,
				un: url.replace(res, "")
			}
		} else {
			return false;
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

	function hide_big_post() {
		var bigCon = document.getElementById("big-container");
		bigCon.style.display = "none";
		document.getElementById("bigger-img").style.display = "none";
		document.getElementById("overlay").style.display = "none";
		curBig = false;
	}

	function hide_comments() {
		var overlay = document.getElementById("overlay");
		overlay.style.display = "none";
		document.getElementById("comment-container").style.display = "none"
		chain.get_by_id(cur_com, function (post) {
			var posts = document.getElementsByClassName("post");
			for (var i = 0; i < posts.length; i++) {
				if (posts.item(i).getElementsByClassName("post-id").item(0).innerHTML.trim() ==
					cur_com.trim()) {
					posts.item(i).getElementsByClassName("comment-post").item(0).innerHTML =
						"Comments: " + post.comments.filter(function (x) {
							return x != null
						}).length;
					break;
				}
			}
		});
	}

	function replLinks(cont, rmfirst) {
		var done = 0;
		var res = /(https*:\/\/\S+\.\S+)/
		var yt =
			/(?:https:\/\/(?:www\.)*youtube\.com\/watch\?v=(\S+))|(?:https*:\/\/youtu\.be\/(\S+))/
		var is = cont.replace(res, function (match) {
			var to = "";
			if (rmfirst && done === 0) {
				done = 1;
			} else {
				var ytT = match.match(yt);
				if (ytT && useYt) {
					// eslint-disable-next-line
					to =
						"<iframe class='ytplayer' type='text/html' width='320' height='180' src='https://www.youtube.com/embed/" +
						ytT[1] + "'></iframe>";
				} else {
					return "<a target='_blank' href='" + match + "'>" + match + "</a>"
				}
			}
			return to;
		});
		if (is) {
			return is
		} else {
			return "";
		}
	}

	function onlyLinks(content) {
		if (content) {
			var res = /(https*:\/\/\S+\.\S+)/;
			var repl = content.replace(res, function (match) {
				return "<a target='_blank' class='follow-col' href='" + match + "'>" +
					match + "</a>";
			});
			if (repl) {
				return repl;
			} else {
				return "";
			}
		} else {
			return "";
		}
	}

	function createContent(content, toAppend, grid, alt, post) {
		var e = checkUrl(content.trim());
		var res = e.res;
		var img;
		var gifIs = false;
		var ilink;
		if (res) {
			var imgC = checkImage(res[0]);
			if (imgC) {
				img = document.createElement("img");
				img.addEventListener("click", function () {
					show_big_post(post);
				});
				var base = res[0];
				if (base.indexOf(".gif") === -1) {
					ilink = "https://images.weserv.nl/?url=" + base.replace("https://", "").replace(
						"http://", "");
				} else {
					gifIs = true;
					ilink = "https://images.weserv.nl/?url=" + base.replace("https://", "").replace(
						"http://", "");
					var playing = false;
					toAppend.addEventListener("click", function () {
						if (playing) {
							img.src = "https://images.weserv.nl/?url=" + base.replace("https://",
								"").replace("http://", "");
							playing = false;
							toAppend.getElementsByClassName("after")[0].style.display = "block";
						} else {
							playing = true;
							if (base.indexOf("demenses.net/cdn") !== -1) {
								img.src = base;
							} else {
								img.src = "https://demenses.net/gif/get?url=" + base.replace(
									"https://", "AhttpsA").replace("http://", "AhttpA");
							}
							toAppend.getElementsByClassName("after")[0].style.display = "none";
						}
					});
				}
				img.className = "post-image";
				res.shift();
			}
		}
		var yes = false;
		if (imgC) {
			yes = true;
		}
		var links = replLinks(content, yes);
		if (!links) {
			links = "";
		}
		links = links.replace("\n", "<br>");
		var res = /(https*:\/\/\S+\.\S+)/;
		var test = content.replace(res, function () {
			return "";
		});
		if (test != "" || links.indexOf("iframe") != -1) {
			toAppend.innerHTML = links;
		}
		if (img) {
			img.addEventListener("load", function () {
				if (grid) {
					setTimeout(function () {
						grid.refreshItems();
						grid.layout();
					}, 75);
				}
			});
			img.addEventListener("error", function () {
				img.alt = ilink;
			});
			if (alt) {
				img.alt = alt;
			}
			toAppend.appendChild(img);
			if (gifIs) {
				var aft = document.createElement("div");
				aft.className = "after";
				aft.innerHTML = "  ";
				toAppend.appendChild(aft);
			}
			img.src = ilink
		}
		if (test == "" && !img && links.indexOf("iframe") == -1) {
			toAppend.innerHTML = "";
			return content;
		}
	}

	function makePost(post, grid) {
		if (!post.title) {
			return;
		}
		var postt = document.createElement("div");
		postt.className = "post";
		var title = document.createElement("div");
		title.className = "post-title";
		title.innerHTML = post.title + " - " + post.favs;
		var auth = document.createElement("div");
		auth.className = "post-auth";
		var name = post.auth;
		if (post.color) {
			name = "<span style='color:" + post.color + "' >" + name + "</span>";
		}
		auth.innerHTML = "by " + name;
		if (post.content) {
			var content = document.createElement("div");
			content.className = "post-content";
			var all = createContent(post.content, content, grid, post.alt, post);
			if (all) {
				title.innerHTML = "<a href ='" + all + "' target='_blank'>" + post.title +
					" - " + post.favs + "</a>";
				content.style.display = "none";
			} else {
				if (post.content.length > 300) {
					content.innerHTML = content.innerHTML.substring(0, 300) + "...<br>";
					var readMore = document.createElement("button");
					readMore.className = "read-more";
					readMore.innerHTML = "Read More";
					readMore.addEventListener("click", function () {
						show_big_post(post);
					});
					content.appendChild(readMore);
				}
			}
		}
		var bar = document.createElement("div");
		bar.className = "post-bar";
		var tags = document.createElement("div");
		tags.className = "post-tags";
		post.tags.forEach(function (tag) {
			var button = document.createElement("button");
			button.className = "tag";
			button.type = "button";
			button.innerHTML = tag;
			button.addEventListener("click", function () {
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
		comments.innerHTML = "Comments: " + post.comments.filter(function (x) {
			return x != null
		}).length;
		comments.addEventListener("click", function (e) {
			prevent(e)
			chain.get_by_id(post.id, function (post) {
				show_comments(post);
			});
		});
		if (post.favorited == true) {
			fav.innerHTML = "Unfavorite"
			fav.addEventListener("click", function (e) {
				prevent(e);
				chain.unfavorite(post.id, function () {
					reloadCur();
				});
			});
		} else {
			fav.innerHTML = "Favorite"
			fav.addEventListener("click", function (e) {
				prevent(e);
				chain.add_favorite(post.id, function () {
					reloadCur();
				});
			});
		}
		if (post.uid == loggedin.uid || loggedin.admin === true) {
			var deleteBut = document.createElement("button");
			deleteBut.className = "delete-post";
			deleteBut.type = "button";
			deleteBut.innerHTML = "Delete";
			deleteBut.addEventListener("click", function () {
					chain.delete_post(post.id, function (res) {
						if (res) {
							notify("Deleted post");
							reloadCur()
						} else {
							notify("Couldn't delete post");
						}
					});
				})
				//buttons.appendChild(deleteBut);
		}
		var shareBut = document.createElement("button");
		shareBut.className = "share-post";
		shareBut.type = "button";
		shareBut.innerHTML = "Share";
		shareBut.addEventListener("click", function () {
			var cdiv = document.getElementById("copy-div");
			cdiv.style.display = "block";
			document.getElementById("copy-fill").innerHTML =
				"https://demenses.net#post?postid=" + post.id;
		});
		if (loggedin.admin === true) {
			var stickyBut = document.createElement("button");
			stickyBut.className = "sticky-post";
			stickyBut.type = "button";
			if (post.stickied) {
				stickyBut.innerHTML = "Unsticky";
			} else {
				stickyBut.innerHTML = "Sticky";
			}
			stickyBut.addEventListener("click", function () {
				if (post.stickied) {
					chain.unsticky(post.id, function (res) {
						if (res) {
							notify("Post unstickied!");
							reloadCur();
						} else {
							notify("Couldn't unsticky post");
						}
					});
				} else {
					chain.sticky(post.id, function (res) {
						if (res) {
							notify("Post stickied!");
							reloadCur();
						} else {
							notify("Couldn't sticky post");
						}
					});
				}
			});
			var banBut = document.createElement("button");
			banBut.className = "ban-post";
			banBut.type = "button";
		}
		var bigBut = document.createElement("button");
		bigBut.innerHTML = "Expand";
		bigBut.className = "big-but";
		bigBut.type = "button";
		bigBut.addEventListener("click", function () {
			show_big_post(post);
		});
		buttons.appendChild(bigBut);
		buttons.appendChild(shareBut);
		buttons.appendChild(comments);
		buttons.appendChild(fav);
		bar.appendChild(buttons);
		var id = document.createElement("div");
		id.className = "post-id";
		var date = new Date(post.date);
		id.innerHTML = post.id;
		var dI = document.createElement("div");
		dI.innerHTML = date.toDateString() + " " + date.toLocaleTimeString("en-US");
		dI.className = "post-date";
		postt.appendChild(title);
		postt.appendChild(auth);
		if (post.content) {
			postt.appendChild(content);
		}
		postt.appendChild(bar);
		postt.appendChild(id);
		postt.appendChild(dI);
		var containerDiv = document.createElement("div");
		containerDiv.className = "post-container";
		containerDiv.appendChild(postt);
		return containerDiv;
	}

	function make_big_post(post) {
		curBig = true;
		bigPost = post;
		var title = document.getElementById("big-title-content")
		title.innerHTML = post.title + " - " + post.favs + "<br>" + post.auth;
		hide_comments();
		document.getElementById("overlay").style.display = "block";
		document.getElementById("big-container").style.display = "flex";
		var date = document.getElementById("big-date");
		var date_obj = new Date(post.date);
		date.innerHTML = date_obj.toDateString() + " " + date_obj.toLocaleTimeString(
			"en-US");
		if (post.content) {
			var e = checkUrl(post.content.trim());
			var res = e.res;
			var img;
			var ilink;
			if (res) {
				var imgC = checkImage(res[0]);
				if (imgC) {
					img = true;
					var base = res[0];
					if (base.indexOf(".gif") === -1) {
						ilink = "https://images.weserv.nl/?url=" + base.replace("https://", "").replace(
							"http://", "");
					} else {
						if (base.indexOf("demenses.net/cdn") !== -1) {
							ilink = base;
						} else {
							ilink = "https://demenses.net/gif/get?url=" + base.replace("https://",
								"AhttpsA").replace("http://", "AhttpA");
						}
					}
					res.shift();
				}
			}
			var yes = false;
			if (imgC) {
				yes = true;
			}
			var links = replLinks(post.content, yes);
			if (!links) {
				links = "";
			}
			links = links.replace("\n", "<br>");
			var bigCont = document.getElementById("big-content");
			var bImg = document.getElementById("big-img");
			if (img) {
				bImg.src = ilink;
				if (post.alt) {
					bImg.alt = post.alt;
				}
			}
			if (links.length > 0) {
				if (links.length < 240) {
					links = "<br>" + links + "<br>";
				}
				bigCont.innerHTML = links;
			}
			if (img && links.length > 0) {
				bImg.className = "";
				bigCont.className = "";
				bigCont.style.display = "block";
				bImg.style.display = "block";
			} else if (img) {
				bImg.className = "big-centered";
				bImg.style.display = "block";
				bigCont.style.display = "none";
				bigCont.className = "";
			} else if (links.length > 0) {
				bigCont.style.display = "block";
				bImg.style.display = "none";
				bImg.className = "";
				bigCont.className = "big-centered";
			}
		}
		var tags = document.getElementById("big-tags");
		removeFrom(tags);
		post.tags.forEach(function (tag) {
			var button = document.createElement("button");
			button.className = "big-tag tag";
			button.type = "button";
			button.innerHTML = tag;
			button.addEventListener("click", function () {
				findByTag(tag);
				hide_big_post();
			});
			tags.appendChild(button);
		});
		var fav = document.getElementById("big-favorite");
		var new_fav = fav.cloneNode(true);
		fav.parentNode.replaceChild(new_fav, fav);
		if (post.favorited == true) {
			new_fav.innerHTML = "Unfavorite"
			new_fav.addEventListener("click", function () {
				chain.unfavorite(post.id, function () {
					reloadCur();
				});
			});
		} else {
			new_fav.innerHTML = "Favorite"
			new_fav.addEventListener("click", function () {
				chain.add_favorite(post.id, function () {
					reloadCur();
				});
			});
		}
		var deleteBut = document.getElementById("big-delete");
		var banBut = document.getElementById("big-ban");
		if (post.uid == loggedin.uid || loggedin.admin === true) {
			deleteBut.style.display = "block";
		} else {
			deleteBut.style.display = "none";
		}
		var stickyBut = document.getElementById("big-sticky");
		if (loggedin.admin) {
			stickyBut.style.display = "block";
			banBut.style.display = "block";
			if (post.stickied) {
				stickyBut.innerHTML = "Unsticky";
			} else {
				stickyBut.innerHTML = "Sticky";
			}
		} else {
			banBut.style.display = "none";
			stickyBut.style.display = "none";
		}
		chain.check_banned(post.uid, function (res) {
			if (res && !res.banned) {
				banBut.innerHTML = "Ban User";
			} else if (res) {
				banBut.innerHTML = "Unban User";
			}
		});
		removeFrom(document.getElementById("big-comments"));
		post.comments.forEach(function (comment) {
			if (comment) {
				createComment(comment, post, document.getElementById("big-comments"));
			}
		});
	}

	function show_big_post(post) {
		make_big_post(post);
	}

	function set_username(username) {
		var us = document.getElementsByClassName("username");
		for (var i = 0; i < us.length; i++) {
			us.item(i).innerHTML = username;
		}
	}

	function makeLoad(grid, cb) {
		var load = document.createElement("div");
		load.className = "load";
		var div = document.createElement("div");
		var button = document.createElement("button");
		button.className = "load-button";
		button.innerHTML = "Load More";
		div.addEventListener("click", function (e) {
			cb(load, function () {
				grid.layout();
				grid.move(load, -1);
			}, e);
		});
		div.appendChild(button);
		load.appendChild(div);
		grid.add(load)
	}

	function makeFake(text) {
		var fake = document.createElement("div");
		fake.className = "fake-post";
		fake.innerHTML = text;
		var con = document.createElement("div");
		con.appendChild(fake);
		return con;
	}
	var mains = {
		"home": function () {
			home_num = 20;
			var max = 10; //eslint-disable-line
			var gotter = {};
			removeGrid(homePage);
			chain.get_top(function (posts) {
				var sorted = Object.keys(posts).sort(function (post1, post2) {
					var b1 = 0;
					var b2 = 0;
					if (posts[post1].stickied) {
						b1 += posts[post1].date;
					}
					if (posts[post2].stickied) {
						b2 += posts[post2].date;
					}
					if (posts[post1].favs + b1 > posts[post2].favs + b2) {
						return -1;
					} else if (posts[post1].favs + b1 < posts[post2].favs + b2) {
						return 1;
					} else {
						return 0;
					}
				});
				var inc = 0;
				sorted.forEach(function (key) {
					if (inc < 10) {
						var post = posts[key];
						gotter[post.id] = true;
						if (post.title) {
							homePage.add([makePost(post, homePage)]);
						}
					}
					inc++
				});
				if (sorted.length >= 10) {
					max = 10;
					makeLoad(homePage, function (load, cb) {
						chain.get_top(function (posts) {
							var sorted = Object.keys(posts).sort(function (post1, post2) {
								var b1 = 0;
								var b2 = 0;
								if (posts[post1].stickied) {
									b1 += posts[post1].date;
								}
								if (posts[post2].stickied) {
									b2 += posts[post2].date;
								}
								if (posts[post1].favs + b1 > posts[post2].favs + b2) {
									return -1;
								} else if (posts[post1].favs + b1 < posts[post2].favs + b2) {
									return 1;
								} else {
									return 0;
								}
							});
							sorted = sorted.filter(function (x) {
								return !gotter[posts[x].id];
							});
							sorted.splice(10, 1000);
							sorted.forEach(function (key) {
								var post = posts[key];
								gotter[post.id] = true;
								if (post.title) {
									homePage.add(makePost(post, homePage));
								}
							});
							cb();
							max += sorted.length;
							home_num += 100;
						}, home_num + 20);
					});
				}
			}, 40);
		},
		"notifications": function () {
			refreshNotifs(function (notifs) {
				removeFrom(document.getElementById("notif-div"));
				notifs.forEach(function (not) {
					document.getElementById("notif-div").appendChild(makeNotification(
						not));
				});
			});
		},
		"curations": function () {
			removeFrom(document.getElementById("fol-curs"));
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch your followed curations";
			document.getElementById("fol-curs").appendChild(li);
			chain.get_curs_top(function (ctop) {
				removeFrom(document.getElementById("pop-curs"));
				ctop.forEach(function (cur) {
					var li = document.createElement("li");
					li.innerHTML = cur;
					li.addEventListener("click", function () {
						findByCuration(cur);
					});
					document.getElementById("pop-curs").appendChild(li);
				});
			});
			chain.get_self(function (me) {
				removeFrom(document.getElementById("fol-curs"));
				var arr = Object.keys(me.curs);
				arr = arr.filter(function (item) {
					if (me.curs[item] === true) {
						return true
					} else {
						return false
					}
				});
				arr.forEach(function (cur) {
					var li = document.createElement("li");
					li.innerHTML = cur;
					li.addEventListener("click", function () {
						findByCuration(cur);
					});
					document.getElementById("fol-curs").appendChild(li);
				});
				if (arr.length == 0) {
					var li = document.createElement("li");
					li.innerHTML = "You're not following any curations!";
					document.getElementById("fol-curs").appendChild(li);
				}
			});
		},
		"search": function () {
			removeFrom(document.getElementById("your-tags"));
			removeFrom(document.getElementById("pop-tags"));
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch your followed tags";
			document.getElementById("your-tags").appendChild(li);
			var li = document.createElement("li");
			li.innerHTML = "Couldn't fetch popular tags";
			document.getElementById("pop-tags").appendChild(li);
			chain.get_self(function (me) {
				removeFrom(document.getElementById("your-tags"));
				Object.keys(me.tags).forEach(function (tag) {
					if (me.tags[tag] == true) {
						var li = document.createElement("li");
						li.innerHTML = tag;
						document.getElementById("your-tags").appendChild(li);
					}
				});
				if (Object.keys(me.tags).length == 0) {
					var li = document.createElement("li");
					li.innerHTML = "You're not following anything!";
					document.getElementById("your-tags").appendChild(li);
				}
			});
			chain.get_top(function (posts) {
				removeFrom(document.getElementById("pop-tags"));
				var tags = {};
				Object.keys(posts).forEach(function (key) {
					var post = posts[key]
					if (post.tags) {
						post.tags.forEach(function (tag) {
							if (tags[tag] == undefined) {
								tags[tag] = 0;
							}
							tags[tag] += post.favs
						});
					}
				});
				var fin = Object.keys(tags).sort(function (tag1, tag2) {
					if (tags[tag1] > tags[tag2]) {
						return -1;
					} else if (tags[tag1] < tags[tag2]) {
						return 1;
					} else {
						return 0;
					}
				}).splice(0, 5);
				fin.forEach(function (tag) {
					var li = document.createElement("li");
					li.innerHTML = tag;
					document.getElementById("pop-tags").appendChild(li);
				});
			});
		},
		"settings": function () {
			document.getElementById('username-form').value = loggedin.username;
			removeFrom(document.getElementById("resu"));
			if (loggedin.admin) {
				document.getElementById("color-admin").style.display = "block";
			} else {
				document.getElementById("color-admin").style.display = "none";
			}
		},
		"pop": function () {},
		"manage": function () {
			var def = document.createElement("li");
			def.innerHTML = "You don't own any curations!";
			document.getElementById("owned-curs").appendChild(def);
			chain.get_self(function (me) {
				removeFrom(document.getElementById("owned-curs"));
				Object.keys(me.curations_owned).filter(function (x) {
					if (me.curations_owned[x]) {
						return true;
					} else {
						return false;
					}
				}).forEach(function (key) {
					var li = document.createElement("li");
					li.innerHTML = key;
					li.addEventListener("click", function () {
						findByCuration(key);
					});
					document.getElementById("owned-curs").appendChild(li);
				});
			});
		},
		"favs": function () {
			favGrid.add(makeFake("No favorited posts!"));
			chain.get_favorites(function (favs) {
				removeGrid(favGrid);
				favs.forEach(function (fav) {
					if (fav) {
						fav.favorited = true;
						favGrid.add(makePost(fav, favGrid));
					}
				});
				if (favs.length == 0) {
					favGrid.add(makeFake("No favorited posts!"));
				}
			});
		},
		"own": function () {
			chain.get_self_posts(function (posts) {
				if (posts) {
					removeGrid(ownPage);
					Object.keys(posts.posts).sort(pdate(posts.posts)).forEach(function (
						key) {
						ownPage.add(makePost(posts.posts[key], ownPage));
					});
				} else {
					notify("Couldn't get your posts!");
				}
			});
		},
		"drop-up": function () {},
		"feed": function () {
			var max_feed = 20;
			var coll = {};
			var max = 0; //eslint-disable-line
			feedPage.add(makeFake("No found posts!"));
			chain.get_feed(function (posts) {
				removeGrid(feedPage);
				Object.keys(posts).sort(pdate(posts)).forEach(function (key) {
					coll[key] = true;
					feedPage.add(makePost(posts[key], feedPage));
				});
				max += Object.keys(posts).length;
				if (Object.keys(posts).length == 0) {
					feedPage.add(makeFake("No found posts!"));
				}
				if (Object.keys(posts).length >= 10) {
					makeLoad(feedPage, function (load, cb) {
						chain.get_feed(function (posts2) {
							var arr = Object.keys(posts2);
							arr.sort(pdate(posts2));
							arr.forEach(function (key) {
								if (coll[key]) {
									//Double
								} else {
									max++;
									coll[key] = true;
									feedPage.add(makePost(posts2[key], feedPage));
								}
							});
							cb()
							max_feed += 20;
						}, max_feed + 20);
					});
				}
			}, 20);
		}
	}
	Object.keys(mains).forEach(function (key) {
		mains[key] = {
			id: key,
			el: document.getElementById(key),
			ref: mains[key]
		}
	});

	function reloadCur() {
		if (curBig) {
			chain.get_by_id(bigPost.id, function (res) {
				show_big_post(res);
			});
		} else {
			switch (cur_show) {
			case 'home':
				upGrid(homePage);
				break;
			case "feed":
				upGrid(feedPage);
				break;
			case "own":
				upGrid(ownPage);
				break;
			case "favs":
				upGrid(favGrid);
				break;
			default:
				showblocking(cur_show);
				break;
			}
		}
	}

	function makeNotification(not) {
		var notif = document.createElement("div");
		var notTitle = document.createElement("div");
		var buttons = document.createElement("div");
		var read = document.createElement("button");
		var notContent = document.createElement("div");
		read.type = "button";
		read.className = "read-button";
		read.innerHTML = "Mark as Read";
		notif.className = "notification";
		notTitle.className = "notif-title";
		notContent.innerHTML = not.content;
		notTitle.innerHTML = not.title;
		read.addEventListener("click", function () {
			chain.rm_notif(not.id, function () {
				reloadCur();
			});
		});
		buttons.appendChild(read);
		notif.appendChild(notTitle);
		notif.appendChild(notContent);
		notif.appendChild(buttons);
		return notif;
	}
	var totNot = 0

	function refreshNotifs(cb) {
		chain.get_notifs(function (notifs) {
			notifs = Object.keys(notifs).map(function (x) {
				return notifs[x];
			});
			var nSpans = document.getElementsByClassName("notif-num");
			for (var i = 0; i < nSpans.length; i++) {
				nSpans.item(i).innerHTML = notifs.length;
			}
			if (notifs.length > totNot) {
				notify("You have " + (notifs.length - totNot) + " new notifications!");
			}
			totNot = notifs.length;
			if (cb) {
				cb(notifs);
			}
		});
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
		var isMobile = window.matchMedia("only screen and (max-device-width: 768px)");
			if(isMobile.matches){
			//mobile, keep hidden
			} else {
		var ls = document.getElementsByClassName("loggedin");
		var li = document.getElementsByClassName("loggedout");
		for (var i = 0; i < ls.length; i++) {
			ls.item(i).style.display = 'block';
		}
		for (var i = 0; i < li.length; i++) {
			li.item(i).style.display = 'none';
		}
			}
	}
	var showblocking = function (toshow) {
		document.getElementById("resu").display = "none";
		removeFrom(document.getElementById("resu"));
		Object.keys(mains).forEach(function (key) {
			var main = mains[key];
			if (key.trim() == toshow.trim()) {
				main.el.style.display = "block";
				if (main.ref) {
					main.ref(main);
				}
			} else {
				main.el.style.display = "none";
			}
		});
		if (toshow === "post") {
			show_big_post(bigPost);
		}
		document.getElementById("results").style.display = "none";
		removeFrom(document.getElementById("results-posts"));
		cur_show = toshow;
		window.scrollTo(0, 0);
	}

	function hideall() {
		Object.keys(mains).forEach(function (key) {
			document.getElementById(key).style.display = "none";
		});
	}
	document.getElementById("navbar").addEventListener("click", function (e) {
		if (e.target.tagName.toLowerCase() == "a") {
			var tar = e.target.attributes.href.value.slice(1);
			showblocking(tar);
		}
	});
	document.getElementById("drop-list").addEventListener("click", function (e) {
		if (e.target.tagName.toLowerCase() == "a") {
			var tar = e.target.attributes.href.value.slice(1);
			showblocking(tar);
		}
	});

	function removeFrom(feed) {
		while (feed.hasChildNodes()) {
			feed.removeChild(feed.lastChild);
		}
	}

	function dispRule(rule, cb, span) {
		var desc = "";
		switch (rule.type) {
		case "not_u":
			desc = "Exclude user <strong>" + rule.value + "</strong>";
			break;
		case "yes_u":
			desc = "Include user <strong>" + rule.value + "</strong>";
			break;
		case "yes_string":
			desc = "Include posts containing <strong>" + rule.value + "</strong>";
			break;
		case "no_string":
			desc = "Exclude posts containing <strong>" + rule.value + "</strong>";
			break;
		default:
			break;
		}
		if (span) {
			return desc;
		}
		var el = document.createElement("li");
		el.className = "currule";
		el.innerHTML = desc + " ";
		var but = document.createElement("button");
		but.className = "curbutx";
		but.innerHTML = "X";
		but.addEventListener("click", function (e) {
			e.target.parentNode.remove();
			cb(e);
		});
		el.appendChild(but);
		return el;
	}

	function findByCuration(cur) {
		cur = cur.toLowerCase();
		var max_res = 20;
		var coll = {};
		var max = 0; //eslint-disable-line
		chain.get_cur_posts(cur, function (posts) {
			removeGrid(resultsPage);
			removeFrom(document.getElementById("cur-mod-tags-list"));
			document.getElementById("results").style.display = "block";
			hideall();
			Object.keys(posts).forEach(function (key) {
				var post = posts[key];
				coll[key] = true;
				max++;
				resultsPage.add(makePost(post, resultsPage));
			});
			if (Object.keys(posts).length >= 10) {
				makeLoad(resultsPage, function (loa, cb) {
					chain.get_cur_posts(cur, function (posts2) {
						var arr = Object.keys(posts2);
						arr.forEach(function (key) {
							if (!coll[key]) {
								max++;
								coll[key] = true;
								resultsPage.add(makePost(posts2[key], resultsPage));
							}
						});
						cb()
						max_res += 20;
					}, max_res + 20);
				});
			}
			chain.get_self(function (me) {
				if (me.curations_owned[cur] === true) {
					document.getElementById("cur-mod").style.display = "block";
					chain.get_cur_mod(cur, function (res) {
						if (res) {
							res.tags.forEach(function (tag, index) {
								document.getElementById("cur-mod-tags-list").appendChild(
									createTagDiv(tag, function () {
										res.tags.splice(index, 1);
										chain.edit_cur_mod(cur, res, function () {
											findByCuration(cur);
											notify("That tag is no longer in the curation " + cur +
												" !");
										});
									}));
							});
							if (Object.keys(res.rules).length > 0) {
								removeFrom(document.getElementById("cur-rules-list"))
								Object.keys(res.rules).forEach(function (key) {
									var rule = res.rules[key];
									var el = dispRule(rule, function () {
										delete res.rules[key];
										chain.edit_cur_mod(cur, res, function () {
											findByCuration(cur);
											notify("That rule has been removed from the curation " +
												cur + " !");
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
			resultsPage.refreshItems();
			resultsPage.layout();
			checkRes();
		}, 20);
	}
		var isMobile = window.matchMedia("only screen and (max-device-width: 768px)");
			if(isMobile.matches){
				document.querySelector("li a[href='#favs']").innerHTML = "Favs";

				document.querySelector("li a[href='#pop']").innerHTML = "Crea";
			}
	function createTagDiv(tag, cb) {
		var toAdd = document.createElement("a");
		toAdd.style['font-size'] = "small";
		toAdd.className = "curtag";
		toAdd.innerHTML = tag + " ";
		var remove = document.createElement("button");
		remove.innerHTML = 'X';
		remove.type = "button";
		remove.className = "create-remove";
		remove.addEventListener("click", function (e) {
			e.target.parentNode.remove();
			cb(tag);
		});
		toAdd.appendChild(remove);
		return toAdd;
	}

	function findByTag(tag) {
		tag = tag.toLowerCase();
		var max_res = 20;
		var coll = {};
		var max = 0; //eslint-disable-line
		chain.get_posts("tag", [tag], function (posts) {
			removeGrid(resultsPage);
			document.getElementById("results").style.display = "block";
			hideall();
			Object.keys(posts).forEach(function (key) {
				var post = posts[key];
				coll[key] = true;
				max++;
				resultsPage.add(makePost(post, resultsPage));
			});
			if (Object.keys(posts).length >= 10) {
				makeLoad(resultsPage, function (load, cb) {
					chain.get_posts("tag", [tag], function (posts2) {
						var arr = Object.keys(posts2);
						arr.forEach(function (key) {
							if (coll[key]) {
								//Double post
							} else {
								max++;
								coll[key] = true;
								resultsPage.add(makePost(posts2[key], resultsPage));
								//document.getElementById("results-posts").insertBefore(makePost(
								//		posts2[key]), load);
							}
						});
						cb()
						max_res += 20;
					}, max_res + 20);
				});
			}
			resultsTag = tag;
			resCur = false;
			resultsPage.layout();
			checkRes();
		}, 20);
	}

	function checkRes() {
		var follow = document.getElementById("results-follow");
		var unfollow = document.getElementById("results-unfollow");
		if (resCur) {
			chain.get_cur_mod(resultsTag, function (rules) {
				document.getElementById("results-cur").style.display = "block";
				document.getElementById("results-tag").style.display = "none";
				document.getElementById('cur-span').innerHTML = resultsTag;
				document.getElementById('cur-follows-span').innerHTML = rules.favs;
				follow = document.getElementById("results-cur-follow");
				unfollow = document.getElementById("results-cur-unfollow");
			});
		} else {
			document.getElementById("cur-mod").style.display = "none";
			document.getElementById("results-cur").style.display = "none";
			document.getElementById("results-tag").style.display = "block";
			document.getElementById("results-span").innerHTML = resultsTag;
		}
		chain.get_self(function (me) {
			var yes = false;
			if (resCur) {
				if (me.curs[resultsTag] === true) {
					yes = true;
					follow.style.display = "none";
					unfollow.style.display = "block";
				} else {
					follow.style.display = "block";
					unfollow.style.display = "none";
				}
			} else {
				Object.keys(me.tags).forEach(function (tag) {
					if (me.tags[tag] == true && tag == resultsTag) {
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
	client.on('disconnect', function(){
		Location.reload();
	});
	client.on('connect', function () {
		var isMobile = window.matchMedia(
			"only screen and (max-device-width: 768px)");
		if (isMobile.matches) {
			var cont = document.getElementById("content");
			cont.rows = 10;
			cont.cols = 25;
		}
		if (token) {
			chain.attempt_token(token, function (res) {
				if (res) {
					setInterval(function () {
						refreshNotifs(function () {});
					}, 30000);
					loggedin.username = res.username;
					loggedin.uid = res.uid;
					loggedin.admin = res.admin;
					loggedin.email = res.email;
					if (loggedin.admin) {
						document.getElementById("color-admin").style.display = "block";
						document.getElementById("color-form").addEventListener("submit",
							function (e) {
								prevent(e);
								var info = e.target.elements;
								var email = info.email.value;
								var color = info.color.value;
								chain.change_color(email, color, function (res) {
									if (res) {
										notify("Changed user " + email + "'s color to " + color);
									} else {
										notify("Couldn't change user's color");
									}
								});
							});
					}
					refreshNotifs(function () {});
				} else {
					window.location.href = "./login.html";
				}
				mains["feed"].ref();
				if (window.location.href.split("#")[1]) {
					if (window.location.href.split("#")[1].includes("post")) {
						var pid = getParameter("postid");
						if (pid) {
							chain.get_by_id(pid, function (res) {
								if (res) {
									show_big_post(res);
								} else {
									notify("Invalid post id! Resetting to home page.");
									showblocking("home");
								}
							});
						} else {
							showblocking("home");
						}
					} else {
						showblocking(window.location.href.split("#")[1]);
					}
				} else {
					showblocking("home");
				}
			});
			document.getElementById("comment").addEventListener("submit", function (e) {
				prevent(e);
				var content = e.target.elements.content.value;
				if (content.length > 0) {
					if (content.length < 256) {
						e.target.reset();
						chain.add_comment(content, cur_com, function () {
							chain.get_by_id(cur_com, function (post) {
								show_comments(post);
							});
						});
					} else {
						alert("A comment must be less than 256 characters!");
					}
				} else {
					alert("A comment must not be empty!");
				}
			});
			document.getElementById("big-share").addEventListener("click", function () {
				var cdiv = document.getElementById("copy-div");
				cdiv.style.display = "block";
				document.getElementById("copy-fill").innerHTML =
					"https://demenses.net#post?postid=" + bigPost.id;
			});
			document.getElementById("copy-x").addEventListener("click", function () {
				document.getElementById("copy-div").style.display = "none";
			});
			var stSheet = document.createElement("style");
			stSheet.innerHTML = "#main > div .post-container:nth-child(-n+" + (Math.floor(
				$(window).width() / 300 * 0.6) + 1) + ") { margin-top:5%}";
			document.getElementById("head").appendChild(stSheet);
			document.getElementById("big-comment").addEventListener("submit",
				function (e) {
					prevent(e);
					var content = e.target.elements.content.value;
					if (content.length > 0) {
						if (content.length < 256) {
							e.target.reset();
							chain.add_comment(content, bigPost.id, function () {
								chain.get_by_id(bigPost.id, function (post) {
									show_big_post(post);
								});
							});
						} else {
							alert("A comment must be less than 256 characters!");
						}
					} else {
						alert("A comment must not be empty!");
					}
				});
			document.getElementById("upload-form").addEventListener("submit",
				function (e) {
					prevent(e);
					$.ajax({
						type: "POST",
						url: "/image/new",
						success: function (res) {
							document.getElementById("content").innerHTML += (
								"https://demenses.net/cdn/" + res);
						},
						processData: false,
						cache: false,
						data: new FormData(this),
						contentType: false
					});
				});
			document.getElementById("create-post").addEventListener("submit",
				function (e) {
					prevent(e);
					var title = e.target.title.value;
					var content = e.target.content.value;
					var tags = [];
					var t = document.getElementsByClassName("create-tags")
					for (var i = 0; i < t.length; i++) {
						tags.push(t.item(i).innerHTML.split("<")[0].trim());
					}
					tags.filter(function (tag) {
						if (tag.length <= 20) {
							return true;
						} else {
							notify("Tag " + tag + " is too long and was removed!");
							return false;
						}
					});
					if (title.length < 140 && content.length < 10000 && title.length > 0) {
						removeFrom(document.getElementById("create-already-tags"));
						chain.create_post(title, content, tags, function (res) {
							if (res) {
								window.location.hash = "#home";
								showblocking('home');
							} else {
								alert(
									"You've been making too many posts recently. Cut it out for a while!"
								);
							}
						});
						document.getElementById("content").innerHTML = "";
						document.getElementById("content").placeholder = "Your content here!";
						e.target.reset();
					}
				});
			document.getElementById("add-rules").type.addEventListener("change",
				function () {
					document.getElementById("rules-desc").innerHTML = dispRule({
						type: document.getElementById("add-rules").type.value,
						value: ""
					}, null, true) + ":";
				});

			document.getElementById("add-rules").addEventListener("submit", function (
				e) {
				prevent(e);
				var val = e.target.string.value;
				var rule = e.target.type.value;
				if (val) {
					e.target.reset();
					chain.get_cur_mod(resultsTag, function (res) {
						var key = rule + "_" + val;
						if (res.rules[key]) {
							notify("That rule is already added to this curation!");
						} else {
							res.rules[key] = {
								type: rule,
								value: val
							}
							chain.edit_cur_mod(resultsTag, res, function (res) {
								if (res) {
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
			document.getElementById("tags-seperator").addEventListener("click",
				function (e) {
					if (e.target.tagName.toLowerCase() == "li") {
						findByTag(e.target.innerHTML);
					}
				});
			document.getElementById("logout").addEventListener("click", function () {
				logout()
				localStorage.removeItem("auth_token");
				location.reload();
			});
			document.getElementById("drop-log").addEventListener("click", function () {
				logout();
				localStorage.removeItem("auth_token");
				location.reload();
			});
			document.getElementById("notif-button").addEventListener("click",
				function () {
					showblocking("notifications");
				});
			document.getElementById("cur-x").addEventListener("click", function () {
				document.getElementById("cur-mod").style.display = "none"
			});
			document.getElementById("createformtags").addEventListener("submit",
				function (e) {
					if (e.target.tag.value.trim()) {
						var toAdd = document.createElement("a");
						toAdd.style['font-size'] = "small";
						toAdd.className = "create-tags";
						toAdd.innerHTML = e.target.tag.value + " ";
						var remove = document.createElement("button");
						remove.innerHTML = 'X';
						remove.type = "button";
						remove.className = "create-remove";
						remove.addEventListener("click", function (e) {
							e.target.parentNode.remove();
						});
						toAdd.appendChild(remove);
						document.getElementById("create-already-tags").appendChild(toAdd);
						e.target.reset();
						prevent(e);
					}
				});
			document.getElementById("cur-tags-form").addEventListener("submit",
				function (e) {
					if (e.target.tag.value.trim()) {
						document.getElementById("toaddcur").appendChild(createTagDiv(e.target
							.tag.value.trim(),
							function () {}));
						prevent(e);
						e.target.reset();
					}
				});
			document.getElementById("big-img").addEventListener("click", function (e) {
				document.getElementById("bigger-img").style.display = "block";
				document.getElementById("overlay-background").style.display = "block";
				document.getElementById("bigger-img").src = e.target.src;
			});
			document.getElementById("bigger-img").addEventListener("click", function () {
				document.getElementById("bigger-img").style.display = "none";
			});
			document.getElementById("view-own").addEventListener("click", function () {
				showblocking("own");
			});
			document.getElementById("create-cur").addEventListener("submit", function (
				e) {
				prevent(e);
				var name = e.target.elements.curname.value.trim();
				var tags = [];
				var t = document.getElementsByClassName("curtag")
				for (var i = 0; i < t.length; i++) {
					tags.push(t.item(i).innerHTML.split("<")[0].trim());
				}
				removeFrom(document.getElementById("toaddcur"));
				if (name && tags.length) {
					chain.create_curation(name, tags, function (res) {
						if (res === true) {
							notify("Curation created!");
							showblocking("manage");
						} else {
							if (res === "already") {
								alert("There's already a curation named that!");
							} else {
								alert("Couldn't create curation!");
							}
						}
					});
				} else {
					alert("Your curation needs to start with a name and at least one tag");
				}
			});
			if (loggedin.admin === true) {
				var stickyBut = document.getElementById("big-sticky");
				if (bigPost.stickied) {
					stickyBut.innerHTML = "Unsticky";
				} else {
					stickyBut.innerHTML = "Sticky";
				}
			}
			document.getElementById("big-sticky").addEventListener("click", function () {
				if (bigPost.stickied) {
					chain.unsticky(bigPost.id, function (res) {
						if (res) {
							notify("Post unstickied!");
							reloadCur();
						} else {
							notify("Couldn't unsticky post");
						}
					});
				} else {
					chain.sticky(bigPost.id, function (res) {
						if (res) {
							notify("Post stickied!");
							reloadCur();
						} else {
							notify("Couldn't sticky post");
						}
					});
				}
			});
			document.getElementById("createmodtag").addEventListener("submit",
				function (e) {
					prevent(e);
					var tag = e.target.tag.value;
					if (tag) {
						e.target.reset();
						chain.get_cur_mod(resultsTag, function (res) {
							if (res) {
								if (res.tags.indexOf(tag) !== -1) {
									notify("Tag already added!");
								} else {
									document.getElementById("cur-mod-tags-list").appendChild(
										createTagDiv(tag, function () {
											chain.get_cur_mod(resultsTag, function (res) {
												res.tags.splice(res.tags.indexOf(tag), 1);
												chain.edit_cur_mod(resultsTag, res, function () {
													findByCuration(resultsTag);
													notify("Tag removed from curation!");
												});
											});
										}));
									res.tags.push(tag)
									chain.edit_cur_mod(resultsTag, res, function () {
										findByCuration(resultsTag);
										notify("Tag added to curation!");
									});
								}
							}
						});
					}
				});
			document.getElementById("settings-email").addEventListener("submit",
				function (e) {
					prevent(e);
					var email = e.target.elements.email.value;
					chain.change_email(email, function (res) {
						if (res) {
							e.target.reset();
							notify("Email changed!");
						} else {
							notify(
								"Could not change email. Maybe someone else has that email?");
						}
					});
				});
			document.getElementById("find-tag").addEventListener("submit", function (
				e) {
				prevent(e);
				var data = e.target.elements.tag.value;
				findByTag(data);
			});
			document.getElementById("results-follow").addEventListener("click",
				function () {
					if (resultsTag !== false) {
						chain.follow_tag(resultsTag, function () {
							notify("Followed " + resultsTag);
							checkRes()
						});
					}
				});
			document.getElementById("big-ban").addEventListener("click", function () {
				if (document.getElementById("big-ban").innerHTML[0].toLowerCase() ==
					"b") {
					chain.ban(bigPost.uid, function (res) {
						if (res) {
							notify("User banned!");
						} else {
							notify("Couldn't ban user");
						}
					});
				} else {
					chain.unban(bigPost.uid, function (res) {
						if (res) {
							notify("User unbanned!");
						} else {
							notify("Couldn't unban user");
						}
					});
				}
				reloadCur();
			});
			document.getElementById("results-cur-follow").addEventListener("click",
				function () {
					if (resultsTag !== false) {
						chain.follow_cur(resultsTag, function () {
							notify("Followed " + resultsTag);
							checkRes();
						});
					}
				});
			document.getElementById("find-curation").addEventListener("submit",
				function (e) {
					prevent(e);
					findByCuration(e.target.cur.value.trim());
				});
			document.getElementById("settings-name").addEventListener("submit",
				function (e) {
					prevent(e);
					if (e.target.elements.username.value < 1 || e.target.elements.username
						.value > 32) {
						notify("Your username must be between 1 and 32 characters long");
					} else {
						chain.change_username(e.target.elements.username.value, function (res) {
							if (res) {
								localStorage.removeItem("auth_token");
								alert(
									"For security reasons, you must log back in after changing your username."
								);
								window.location.href = "/login.html";
							} else {
								alert("Couldn't change username");
							}
						});
					}
				});
			document.getElementById("overlay-background").addEventListener("click",
				function () {
					if (curBig) {
						hide_big_post();
					} else {
						hide_comments();
					}
				});
			document.getElementById("big-delete").addEventListener("click", function () {
				chain.delete_post(bigPost.id, function (res) {
					if (res) {
						notify("Deleted post");
						curBig = false;
						reloadCur();
						hide_big_post();
					} else {
						notify("Couldn't delete post");
					}
				});
			});
			document.getElementById("delete-cur").addEventListener("click", function () {
				if (resCur && resultsTag) {
					chain.delete_curation(resultsTag, function () {
						notify("Deleted curation " + resultsTag);
						reloadCur();
					});
				}
			});
			document.getElementById("results-unfollow").addEventListener("click",
				function () {
					if (resultsTag !== false) {
						chain.unfollow(resultsTag, function () {
							notify("Unfollowed " + resultsTag);
							checkRes()
						});
					}
				});
			document.getElementById("results-cur-unfollow").addEventListener("click",
				function () {
					if (resultsTag !== false) {
						chain.unfollow_cur(resultsTag, function () {
							notify("Unfollowed " + resultsTag);
							checkRes();
						});
					}
				});
		} else {
			window.location = "/login.html";
		}
	});
}
