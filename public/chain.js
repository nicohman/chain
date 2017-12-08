window.onload = function() {
    console.log("Chain initialized");
    var client = io("http://localhost:3000");
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
            
		Object.keys(results.posts).forEach(function(key){
			posts[key] = results.posts[key];
		});	
		if(counted >= 2){
		 client.off("c_got_posts_" + data);
			cb(posts);

		}

        });

    }
    client.on('connect', function() {
        console.log("connected");
        get_posts("tag", ["first"], function(posts) {
            console.log("called");
            console.log(posts);
            Object.keys(posts).forEach(function(postkey) {
                var post = posts[postkey];
                document.getElementById("posts").appendChild(document.createTextNode(post.title));
            });
        });
    });
}
