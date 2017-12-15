window.onload = function() {
    var client = io("http://localhost:3000");
    var loggedin = {};
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
                }
                cb(null, newtoken);
            });
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
                client.once("c_followed_tag_" + tag, function(res) {
                    cb(res);
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
                client.once("c_added_favorite_" + loggedin.uid + "_" + pid, function(res) {
                    cb(res);
                });
            }
        },

        get_feed: function get_feed(cb) {
            client.emit("c_get_feed", {
                cid: client.id
            });
            console.log("c_got_feed_" + loggedin.uid);
            client.once("c_got_feed_" + loggedin.uid, function(posts) {

                console.log(posts);
                cb(posts);
            });
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
			set_username(res.username);
                    //notify("Welcome back, " + res.username);
                } else {

                }
                cb(res);
            });
        },

        create_post: function create_post(title, content, tags, cb) {
            client.emit("c_create_post", {
                title: title,
                content: content,
                auth: "me",
                tags: tags,
                cid: client.id
            });
            client.once("c_created_post", function(results) {
                cb(results);

            });
        },


        get_posts: function get_posts(filter, data, cb) {
            var counted = 0;
            var posts = {};
            client.emit("c_get_posts", {
                filter: filter,
                count: 10,
                id: client.id,
                data: data
            });
            client.on("c_got_posts_" + data, function(results) {
                counted++;

                Object.keys(results.posts).forEach(function(key) {
                    posts[key] = results.posts[key];
                });
                console.log("gotten");
                if (counted >= 2) {
                    client.off("c_got_posts_" + data);
                    cb(posts);

                }

            });

        }
    }

    function notify(text) {
        document.getElementById("notifications").appendChild(document.createTextNode(text));
    }

    function show_post(post, toAppend) {
        var postt = document.createElement("div");
        postt.className = "post";
        postt.appendChild(document.createTextNode(post.title));
        postt.appendChild(document.createTextNode(post.auth));
        postt.appendChild(document.createTextNode(post.content));
        postt.appendChild(document.createTextNode(post.tags));
        postt.appendChild(document.createTextNode(post.id));
        toAppend.appendChild(postt);
    }

function set_username(username){
	var us = document.getElementsByClassName("username");
	for(var i=0;i < us.length;i++){
		console.log("set");
		us.item(i).innerHtml = username;
	}
}
    var mains = {
        "home": function() {},
        "pop": function() {},
        "search": function() {},
        "feed": function(that) {
            chain.get_feed(function(posts) {
                Object.keys(posts).forEach(function(key) {
			console.log(that.el);
                    show_post(posts[key], that.el.children.namedItem("posts"));
                });
            });
        },
    }
    Object.keys(mains).forEach(function(key, index) {
        mains[key] = {
            id: key,
            el: document.getElementById(key),
            ref: mains[key]
        }
    });

    var showblocking = function(toshow) {
        Object.keys(mains).forEach(function(key) {
            var main = mains[key];
            if (main.el.id == toshow) {
                if (main.ref) {
                    main.ref(main);
                }
                main.el.style.display = "block";
                console.log("Shown");
            } else {
                main.el.style.display = "none";
            }
            console.log(main.el.id + " " + toshow);
        });
    }
    document.getElementById("navbar").addEventListener("click", function(e) {
        var tar = e.target.attributes.href.value.slice(1);
        showblocking(tar);
    });

    client.on('connect', function() {
        console.log("connected");
        if (token) {
            chain.attempt_token(token, function(res) {
                if (res) {
                    loggedin.username = res.username;
                    loggedin.uid = res.uid;
                }
            });
        }
    });
}
