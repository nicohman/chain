window.onload = function() {
	var client = io("http://localhost:3000");

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
		}
	}
	var loginform = document.getElementById("login");
	loginform.addEventListener("submit", function(e){
		e.preventDefault();
		var form = e.target.elements;
		chain.attempt_login(form.uid.value, form.pass.value, function(err, newtoken){
			if(newtoken){
				window.location = "http://localhost:3953/phase.html";
			} else {
				alert("Wrong login!");
				e.target.reset();
			}
		});
	});
}
