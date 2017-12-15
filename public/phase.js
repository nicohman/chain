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
                    login();
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
                    login();
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
        var title = document.createElement("div");
        title.className = "post-title";
        title.innerHTML = post.title
        var auth = document.createElement("div");
        auth.className = "post-auth";
        auth.innerHTML = "by " + post.auth;
        var content = document.createElement("div");
        content.className = "post-content";
        content.innerHTML = post.content;
        var bar = document.createElement("div");
        bar.className = "post-bar";
        var tags = document.createElement("div");
        tags.className = "post-tags";
        tags.innerHTML = post.tags;
        bar.appendChild(tags);
        var buttons = document.createElement("div");
        buttons.className = "post-buttons";
        var fav = document.createElement("button");
        fav.className = "fav-post";
        fav.type = "button";
        fav.innerHTML = "Favorite"
        fav.addEventListener("click", function(e) {
            e.preventDefault();
            chain.add_favorite(e.target.parentNode.parentNode.parentNode.getElementsByClassName("post-id").item(0).innerHTML, function(res) {
                notify(res);
            });
        });
        buttons.appendChild(fav);
        bar.appendChild(buttons);
        var id = document.createElement("div");
        id.className = "post-id";
        id.innerHTML = post.id;
        postt.appendChild(title);
        postt.appendChild(auth);
        postt.appendChild(content);
        postt.appendChild(bar);
        postt.appendChild(id);
        toAppend.appendChild(postt);
    }

    function set_username(username) {
        var us = document.getElementsByClassName("username");
        for (var i = 0; i < us.length; i++) {
            console.log("set");
            us.item(i).innerHTML = username;
        }
    }
    var mains = {
        "home": function() {},
        "pop": function() {},
        "search": function() {},
        "favs": function() {
            removeFrom(document.getElementById("fav"));
            chain.get_favorites(function(favs) {
                favs.forEach(function(fav) {
                    show_post(fav, document.getElementById("fav"));
                });
            });

        },
        "feed": function(that) {
            removeFrom(document.getElementById("posts"));
            chain.get_feed(function(posts) {
                Object.keys(posts).forEach(function(key) {
                    console.log(that.el);
                    show_post(posts[key], that.el.children.namedItem("posts"));
                });
            });
        }
    }
    Object.keys(mains).forEach(function(key, index) {
        mains[key] = {
            id: key,
            el: document.getElementById(key),
            ref: mains[key]
        }
    });

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
    client.on('connect', function() {
        console.log("connected");
        if (token) {
            chain.attempt_token(token, function(res) {
                if (res) {
                    loggedin.username = res.username;
                    loggedin.uid = res.uid;
                }
                if (window.location.href.split("#")[1]) {

                    showblocking(window.location.href.split("#")[1]);
                } else {
                    showblocking("home");
                }
            });
            document.getElementById("create-post").addEventListener("submit", function(e) {
                e.preventDefault();
                var title = e.target.title.value;
                var content = e.target.content.value;
                var tags = [];
                var t = document.getElementsByClassName("create-tags")
                for (var i = 0; i < t.length; i++) {
                    tags.push(t.item(i).innerHTML.split("<")[0].trim());
                }
                chain.create_post(title, content, tags, function(res) {
                    notify("Posted!");
                });
                e.target.reset();

            });
            document.getElementById("createformtags").addEventListener("submit", function(e) {
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
                e.preventDefault();
            });

        } else {
            window.location = "/login.html";

        }
    });
}
