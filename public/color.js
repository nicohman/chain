function notify(text) {
	if (!("Notification" in window)) {
		console.log("Notification: " + text);
	} else if (Notification.permission === "granted") {
		var notification = new Notification(text);
		setTimeout(notification.close.bind(notification), 5000);
	} else if (Notification.permission !== "denied") {
		Notification.requestPermission(function (permission) {
			if (permission === "granted") {
				var notification = new Notification(text);
				setTimeout(notification.close.bind(notification), 3000);
			}
		});
	}
}
var schemes = {
	"solarized": {
		"main-bg": "#073642",
		"sec-bg": "#002b36",
		"border": "#2aa198",
		"text": "#93a1a1",
		"follow": "#657b83"
	},
	"jackson": {
		"main-bg": "#C6CAD1",
		"sec-bg": "#D15000",
		"border": "#C6CAD1",
		"text": "#F7F5FA",
		"follow": "#3F88C5"
	},
	"monokai": {
		"main-bg": "#272822",
		"sec-bg": "#272822",
		"border": "#FD971F",
		"text": "#FFFFFF",
		"follow": "#66D9EF"
	}
}
var logos = {
	"monokai": "logo-monokai.png"
}
if (localStorage.getItem("colorscheme")) {
	changeColorscheme(localStorage.getItem("colorscheme"));
} else {
	changeColorscheme("solarized");
}

function changeColorscheme(scheme) {
	if (scheme === "custom") {
		var cust = localStorage.getItem("customcolorscheme");
		if (cust) {
			try {
				cust = JSON.parse(cust);
				if (cust["main-bg"] && cust["sec-bg"] && cust.border && cust.text && cust.follow) {
					schemes["cust-cs"] = cust;
					changeColorscheme("cust-cs");
				} else {
					notify(
						"There was an error with your custom colorscheme. Resetting to default.\nError Code: D_CCSNC"
					);
				}
			} catch (e) {
				notify(
					"There was an error with your custom colorscheme. Resetting to default.\nError Code: D_CCSNF"
				);
				changeColorscheme("solarized");
			}
		} else {
			notify(
				"There was an error with your custom colorscheme. Resetting to default.\nError Code: D_CCSNE"
			);
			changeColorscheme("solarized");
		}
	} else {
		var logo = "logo.png";
		if (!schemes[scheme]) {
			scheme = "solarized";
		}
		if (logos[scheme]) {
			logo = logos[scheme];
		}
		Object.keys(schemes[scheme]).forEach(function (key) {
			document.getElementsByTagName("html")[0].style.setProperty("--" + key,
				schemes[scheme][key]);
		});
		setTimeout(function(){
		document.getElementsByClassName("large-logo")[0].src =
			"https://demenses.net/" + logo;
		},500);
	}
}
