window.onload = function() {
	var client = io("http://24.113.235.229:3000");

	var chain = {
		attempt_login: function attempt_login(email, password, cb) {
			client.emit("c_login", {
				email:email,
				password: password,
				cid: client.id
			});

			client.once("c_logged_in_" + email, function(newtoken) {
				console.log("res");
				if (newtoken) {
					token = newtoken
					localStorage.setItem("auth_token", newtoken);

				}
				cb(null, newtoken);
			});
		},
		req_rec: function(email, cb){
			client.emit("c_req_rec", {
				email:email,
				cid:client.id
			});
			client.once("c_reqed_reced", function(res){
				cb(res);
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
	var recform = document.getElementById("rec-form");
	recform.addEventListener("submit", function(e){
		e.preventDefault();
		var email = e.target.elements.email.value;
		chain.req_rec(email, function(res){
			if(res){
				alert("Send your email a recovery link.");
			} else {
				alert("Not able to send a link. Does this account exist?");
			}
		});
	});
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
							window.location.href = "/index.html";
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
		chain.attempt_login(form.email.value, form.pass.value, function(err, newtoken) {
			if (newtoken) {
				window.location.href = "/index.html";
			} else {
				alert("Wrong login!");
				e.target.reset();
			}
		});
	});
}
