window.onload = function() {
    console.log("Chain initialized");
    var client = io("http://localhost:3000");
    var search = document.getElementById("tag");
    var create = document.getElementById("create");
    var login = document.getElementById("login");
    var token = localStorage.getItem("auth_token");
    var logout = document.getElementById("logout");
    var follow = document.getElementById("follow");
    var loggedin = {};

    function attempt_login(uid, password, cb) {
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
    }

    function follow_tag(tag, cb) {
        if (loggedin.uid && token) {
            client.emit("c_follow_tag", {
                cid: client.id,
                tag: tag,
		    token:token,
                uid: loggedin.uid
            });
            client.once("c_followed_tag_" + tag, function(res) {
                cb(res);
            });
        }
    }

    function attempt_token(token, cb) {
        client.emit("c_token_login", {
            token: token,
            cid: client.id
        });
        console.log("emitted");
        client.once("c_token_logged_in", function(res) {
            console.log(res);
            if (res) {
                notify("Welcome back, " + res.username);
            } else {

            }
            cb(res);
        });
    }

    function create_post(title, content, tags, cb) {
        client.emit("c_create_post", {
            title: title,
            content: content,
            auth: "me",
            tags: tags,
            cid: client.id
        });
        client.once("c_created_post", function(results) {
            cb(results);
            2
        });
    }

    function notify(text) {
        document.getElementById("notifications").appendChild(document.createTextNode(text));
    }

    function get_posts(filter, data, cb) {
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
            if (counted >= 2) {
                client.off("c_got_posts_" + data);
                cb(posts);

            }

        });

    }
    client.on('connect', function() {
        console.log("connected");
        if (token) {
            attempt_token(token, function(res) {
                if (res) {
                    loggedin.username = res.username;
                    loggedin.uid = res.uid;
                }
            });
        }
        follow.onsubmit = function() {
            var followdata = follow.elements.tag.value;
            follow_tag(followdata, function(res) {
                notify(res)
            })
		return false;
        }
        logout.onsubmit = function() {
            localStorage.removeItem("auth_token");
            window.location.reload(true);
        }
        create.onsubmit = function() {
            var createdata = create.elements;
            console.log(create);
            create_post(createdata.title.value, createdata.content.value, createdata.tags.value.split(" "), function(res) {
                notify("Posted!");
            });
            return false;
        }
        login.onsubmit = function() {
            var logindata = login.elements;
            attempt_login(logindata.uid.value, logindata.password.value, function(err, res) {
                notify(res);
                if (res) {
                    loggedin.uid = logindata.uid.value;
                }
            });
            return false;
        }
        search.onsubmit = function() {
            console.log("submitted");
            var searchdata = search.elements;
            console.log(searchdata);
            var postel = document.getElementById("posts");
            get_posts("tag", [searchdata.tag.value], function(posts) {
                console.log("called");
                console.log(posts);
                while (postel.hasChildNodes()) {
                    postel.removeChild(postel.lastChild);
                }
                var keys = Object.keys(posts);
                if (keys.length < 1) {
                    postel.appendChild(document.createTextNode("No posts found!"));

                }
                keys.forEach(function(postkey) {
                    var post = posts[postkey];
                    postel.appendChild(document.createTextNode(post.title));
                });
            });
            return false;
        }
    });
}
