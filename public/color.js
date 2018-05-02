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
	"elephantine":{
		"main-bg":"#1f232b",
		"sec-bg":"#282c37",
		"border":"#9baec8",
		"text":"#d9e1e8",
		"follow":"#2b90d9"
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
		"sec-bg": "#313325",
		"border": "#b36a13",
		"text": "#FFFFFF",
		"follow": "#66D9EF"
	},
	"gruvbox": {
		"main-bg": "#282828",
		"sec-bg": "#1d2021",
		"border": "#98971a",
		"text": "#eddbb2",
		"follow": "#458588"
	}
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
		if (!schemes[scheme]) {
			scheme = "solarized";
		}
		Object.keys(schemes[scheme]).forEach(function (key) {
			document.getElementsByTagName("html")[0].style.setProperty("--" + key,
				schemes[scheme][key]);
		});
		setTimeout(function () {
			document.getElementsByClassName("large-logo")[0].src =
				"https://demenses.net/logo/big/" + schemes[scheme]["sec-bg"].replace("#",
					"") + "/FFFFFF";
			document.getElementsByClassName("small-logo")[0].src =
				"https://demenses.net/logo/small/" + schemes[scheme]["sec-bg"].replace(
					"#", "") + "/" + schemes[scheme]["border"].replace("#", "");
			var isMobile = window.matchMedia("only screen and (max-device-width: 768px)");
			if(isMobile.matches){
			var icons = document.getElementsByClassName("icon");
			for(var i = 0; i < icons.length; i++) {
				var name;
				switch(icons.item(i).href.split("#")[1]){
					case "home":
						name = "home";
						break;
					case "favs":
						name = "fav";
						break;
					case "feed":
						name = "feed";
						break;
					case "pop":
						name = "create";
						break;
					default:
						//name = icons.item(i).href.replace("#","");
						break;
				}
				icons.item(i).style["background-image"] = "url('https://demenses.net/icons/"+name+"/"+schemes[scheme]["follow"].replace("#", "")+"')";
			}
			}
		}, 100);
	}
}
