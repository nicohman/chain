window.onload = function() {
        console.log("Chain initialized");
        var client = io("http://localhost:3000");
        var search = document.getElementById("tag");
        var create = document.getElementById("create");
	var login = document.getElementById("login");
	function attempt_login(uid, password, cb){
		client.emit("c_login", {
			uid:uid,
			password:password,
			cid:client.id
		});
		client.once("c_logged_in_"+uid, function(res){
			cb(null, res);
		});
	}
        function create_post(title, content,tags, cb) {
            client.emit("c_create_post", {
                title: title,
                content: content,
		    auth:"me",
		    tags:tags,
		    cid:client.id
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
                create.onsubmit = function() {
                    var createdata = create.elements;
			console.log(create);
                    create_post(createdata.title.value, createdata.content.value, createdata.tags.value.split(" "), function(res) {
                        notify("Posted!");
                    });
			return false;
                }
		    login.onsubmit = function(){
		    	var logindata = login.elements;
			 attempt_login(logindata.uid.value, logindata.password.value, function(err, res){
			 	notify(res);
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
