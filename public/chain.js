window.onload = function() {
    console.log("Chain initialized");
    var client = io("http://localhost:3000");
    var search = document.getElementById("tag");

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
