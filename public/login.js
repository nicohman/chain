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
		},
		createUser: function(username, password, email, cb) {

			client.emit("c_find_user_by_email", {
				cid: client.id,
				email: email
			});
			client.once("c_found_user_by_email_" + email, function(res) {
				if (res == false) {
					client.emit("c_create_user", {
						cid: client.id,
						email: email,
						username: username,
						password: password
					});
					client.once("c_created_user", function(id) {
						cb(id);
					});
				} else {
					cb(false);
				}
			});

		}
	}
	var loginform = document.getElementById("login");
	var createform = document.getElementById("create");
	createform.addEventListener("submit", function(e) {
		e.preventDefault();
		var form = e.target.elements;
		if (form.pass.value == form["pass-repeat"].value) {
			chain.createUser(form.name.value, form.pass.value, form.email.value, function(res) {
				if (res == false) {
					createform.reset();
					alert("Email already used!");
				} else {
					chain.attempt_login(res, form.pass.value, function(err, newtoken) {
						if (newtoken) {
							window.location = "http://localhost:3953/phase.html";
						}
					});
				}
			});
		} else {
			createform.reset();
			alert("Passwords do not match!");
		}


	});
	loginform.addEventListener("submit", function(e) {
		e.preventDefault();
		var form = e.target.elements;
		chain.attempt_login(form.uid.value, form.pass.value, function(err, newtoken) {
			if (newtoken) {
				window.location = "http://localhost:3953/phase.html";
			} else {
				alert("Wrong login!");
				e.target.reset();
			}
		});
	});
}
