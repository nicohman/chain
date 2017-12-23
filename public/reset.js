window.onload = function(){
	document.getElementById("reset").addEventListener("submit", function(e){
		if(e.target.elements.pass1.value == e.target.elements.pass2.value){
		
		} else {
			alert("Passwords not the same!");
			e.preventDefault();
			e.target.reset()
		}
	});

}
