var URLFIXER = {
	get strings() { return document.getElementById("url-fixer-bundle"); },
	
	load : function () {
		// Add our typo-fixing function to the URL bar
		this.addTypoFixer();
		
		// Listen for manual preference changes
		this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.url-fixer.");
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);
	},
	
	observe: function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "askFirst":
				// Update the checked property on the URL bar's context menu.
				if (document.getElementById("url-fixer-askFirst")){
					document.getElementById("url-fixer-askFirst").setAttribute("checked", this.prefs.getBoolPref("askFirst"));
				}
			break;
		}
	},
	
	addTypoFixer : function() {
		var urlbars = [ document.getElementById('urlbar'), document.getElementById('urlbar-edit') ];
		
		for (var i = 0; i < urlbars.length; i++) {
			var urlbar = urlbars[i];
			
			if (urlbar) {
				// Add the "Confirm corrections" menu option the first time the context menu appears
				urlbar.addEventListener("popupshowing", function (event) { URLFIXER.addAskFirstOption(event); }, true);
			
				// Save the old ontextentered function so that we don't lose functionality
				urlbar.oldOnTextEntered = urlbar.onTextEntered;
			
				urlbar.onTextEntered = function (justCorrect) {
					// Trim it
					this.value = this.value.replace(/^\s*|\s*$/g,"");
				
					var goAhead = true;
				
					// Don't correct anything starting with javascript:
					if (this.value.indexOf("javascript:") == 0) {
						goAhead = false;
					}
				
					if (this.value.indexOf("data:") == 0) {
						goAhead = false;
					}
					
					// If there's a space before a /, or no / at all, don't correct it.
					// It's probably a quicksearch.
					var firstSpace = this.value.indexOf(" ");
					var firstSlash = this.value.indexOf("/");
				
					if (firstSpace != -1 && firstSlash == -1) {
						goAhead = false;
					}
				
					if (goAhead) {
						// Determine if the text starts with a keyword
						if (typeof getShortcutOrURI != 'undefined' && this.value != getShortcutOrURI(this.value, {})){
							goAhead = true;
						}
					}
					
					if (goAhead){
						var res = [
							{find : ";//", replace : "://"},
					
							// Comma or semicolon instead of dot
							{find : "([a-z0-9])([,;])([a-z0-9])", replace : "$1.$3"},
						
							// Incomplete protocol
							{find: "^h?t{1,2}p?(s?)://", "replace" : "http$1://"},
							{find: "^h.{1,3}p(s?)://", "replace" : "http$1://"},
							{find: "^f.{0,2}p://", "replace" : "ftp://"},
							{find: "^(i.{0,2}c|[irc]{2,4})://", "replace" : "irc://"},
						
							// Extra letter before or after protocol
							{find: "^.?(https|http|irc|ftp).?://", "replace" : "$1://"},
						
							// Only two of the three w's
							{find: "^w{2,4}(\\.)", "replace" : "www."},
							{find: "//ww(\\.)", "replace" : "//www."},
						
							// Missing the dot
							{find: "([^\\.])(com|net|org|edu|mil|gov|aero|biz|coop|info|museum|name|pro|cat|jobs|mobi|travel)$", replace : "$1.$2"},
						
							// One letter off/missing one letter
							{nomatch : "(\\.(cc|mm|co|cm|mc|om|mo)$)", find : "\\.(co[^m]|c[^o]m|[^c]om|[com]{2,3})$", replace : ".com"},
							{nomatch : "(\\.(ee|tt|ne|nt|et|tn)$)", find : "\\.(ne[^t]|n[^e]t|[^n]et|[net]{2,3})$", replace : ".net"},
							{nomatch : "(\\.(gg|ro|gr)$)", find : "\\.(or[^g]|o[^r]g|[^o]rg|[org]{2,3})$", replace : ".org"},
							{nomatch : "(\\.(ee|eu|de)$)", find : "\\.(ed[^u]|e[^d]u|[^e]du|[edu]{2,3})$", replace : ".edu"},
							{nomatch : "(\\.(gg|vg)$)", find : "\\.(go[^v]|g[^o]v|[^g]ov|[gov]{2,3})$", replace : ".gov"},
							{nomatch : "(\\.(mm|ml|im|il|li)$)", find : "\\.(mi[^l]|m[^i]l|[^m]il|[mil]{2,3})$", replace : ".mil"},
							{find : "\\.(aer[^o]|ae[^r]o|a[^e]ro|[^a]ero|[aero]{3,4})$", replace : ".aero"},
							{nomatch : "(\\.(bb|bi|bz)$)", find : "\\.(bi[^z]|b[^i]z|[^b]iz|[biz]{2,3})$", replace : ".biz"},
							{find : "\\.(coo[^p]|co[^o]p|c[^o]op|[^c]oop|[cop]{3,4})$", replace : ".coop"},
							{find : "\\.(inf[^o]|in[^f]o|i[^n]fo|[^i]nfo|[info]{3,4})$", replace : ".info"},
							{find : "\\.(museu[^m]|muse[^u]m|mus[^e]um|mu[^s]eum|m[^u]seum|[^m]useum|[museum]{5,6})$", replace : ".museum"},
							{find : "\\.(nam[^e]|na[^m]e|n[^a]me|[^n]ame|[name]{3,4})$", replace : ".name"},
							{nomatch : "(\\.(pr|ro)$)", find : "\\.(pr[^o]|p[^r]o|[^p]ro|[pro]{2,3})$", replace : ".pro"},
							{nomatch : "(\\.(cc|ca|ac|at|tc|tt)$)", find : "\\.(ca[^t]|c[^a]t|[^c]at|[cat]{2,3})$", replace : ".cat"},
							{find : "\\.(job[^s]|jo[^b]s|j[^o]bs|[^j]obs|[jobs]{3,4})$", replace : ".jobs"},
							{find : "\\.(mob[^i]|mo[^b]i|m[^o]bi|[^m]obi|[mobi]{3,4})$", replace : ".mobi"},
							{find : "\\.(trave[^l]|trav[^e]l|tra[^v]el|tr[^a]vel|t[^r]avel|[^t]ravel|[travel]{5,6})$", replace : ".travel"},
						
							// Extra letter
							{find : "\\.(c.om|co.m)$", replace : ".com"},
							{find : "\\.(n.et|ne.t)$", replace : ".net"},
							{find : "\\.(o.rg|or.g)$", replace : ".org"},
							{find : "\\.(e.du|ed.u)$", replace : ".edu"},
							{find : "\\.(g.ov|go.v)$", replace : ".gov"},
							{find : "\\.(m.il|mi.l)$", replace : ".mil"},
							{find : "\\.(a.ero|ae.ro|aer.o)$", replace : ".aero"},
							{find : "\\.(b.iz|bi.z)$", replace : ".biz"},
							{find : "\\.(c.oop|co.op|coo.p)$", replace : ".coop"},
							{find : "\\.(i.nfo|in.fo|inf.o)$", replace : ".info"},
							{find : "\\.(m.useum|mu.seum|mus.eum|muse.um|museu.m)$", replace : ".museum"},
							{find : "\\.(n.ame|na.me|nam.e)$", replace : ".name"},
							{find : "\\.(p.ro|pr.o)$", replace : ".pro"},
							{find : "\\.(c.at|ca.t)$", replace : ".cat"},
							{find : "\\.(j.obs|jo.bs|job.s)$", replace : ".jobs"},
							{find : "\\.(m.obi|mo.bi|mob.i)$", replace : ".mobi"},
							{find : "\\.(t.ravel|tr.avel|tra.vel|trav.el|trave.l)$", replace : ".travel"},
						
							// Extra letter at the end or before the tld
							{find: "\\..?(com|net|org|edu|mil|gov|aero|biz|coop|info|museum|name|pro|cat|jobs|mobi|travel).?$", replace : ".$1"}
						];
					
						var urlValue;
					
						// Get the domain part
						if (this.value.indexOf("/") == -1){
							// No slashes - only domain
							urlValue = this.value;
						}
						else if (this.value.indexOf("//") == -1){
							// 1+ singles slashes: no protocol, path may be there
							urlValue = this.value.substring(0, this.value.indexOf("/"));
						}
						else if (this.value.indexOf("//") != -1){
							// Protocol is there.
						
							if (this.value.indexOf("/",this.value.indexOf("//") + 2) == -1){
								// only //: protocol and domain
								urlValue = this.value;
							}
							else {
								urlValue = this.value.substring(0, this.value.indexOf("/",this.value.indexOf("//") + 2));
							}
						}
					
						// Save the domain part we found so we can tell if it changed
						var oldValue = urlValue;
					
						// Lower case it to avoid making all REs case-insensitive
						urlValue = urlValue.toLowerCase();
					
						// Apply all of the RE changes listed above
						for (var i = 0; i < res.length; i++){
							urlValue = URLFIXER.applyRE(urlValue, res[i]);
						}
					
						if (urlValue != oldValue.toLowerCase()){
							urlValue = this.value.replace(oldValue, urlValue);
						
							if (URLFIXER.prefs.getBoolPref("askFirst")){
								// Ask before making the actual change
								var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
							
								var check = { value: true };
								var flags = 
									prompts.BUTTON_TITLE_YES * prompts.BUTTON_POS_0 +
									prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_1 +
									prompts.BUTTON_TITLE_NO * prompts.BUTTON_POS_2;
							
								var button = prompts.confirmEx(window, URLFIXER.strings.getString("urlfixer.confirmTitle"), URLFIXER.strings.getString("urlfixer.didYouMean").replace("#",urlValue), flags, URLFIXER.strings.getString("urlfixer.yes"), URLFIXER.strings.getString("urlfixer.cancel"), URLFIXER.strings.getString("urlfixer.no"), URLFIXER.strings.getString("urlfixer.askFirst"), check);
							
								if (button == 1){
									// User chose "Cancel"
									return false;
								}
								else {
									
									if (!check.value) {
										URLFIXER.prefs.setBoolPref("askFirst", false);
									}
									
									if (button == 0){
										// User chose "Yes"
										this.value = urlValue;
									}
								}
							}
							else {
								// No confirmation needed
								this.value = urlValue;
							}
						}
					
						if (justCorrect) {
							return true;
						}
						else {
							return this.oldOnTextEntered();
						}
					}
					else if (justCorrect) {
						return true;
					}
					else {
						return this.oldOnTextEntered();
					}
				};
					
				// Check for the Go button
				var goButtons = [ document.getElementById("go-button"), document.getElementById("tool-go") ];
				
				for (var i = 0; i < goButtons.length; i++) {
					var goButton = goButtons[i];
					
					if (goButton){
						// Add the correction when the Go button is used
						if (typeof BrowserUI != 'undefined' && goButton.getAttribute("command")) {
							goButton.setAttribute("other_command",goButton.getAttribute("command"));
							goButton.removeAttribute("command");
							goButton.setAttribute("oncommand", "if (document.getElementById('"+urlbar.id+"').onTextEntered(true)) { BrowserUI.doCommand(this.getAttribute('other_command')); }");
							
						}
						else if (goButton.getAttribute("oncommand")) {
							goButton.setAttribute("oncommand", "if (document.getElementById('"+urlbar.id+"').onTextEntered(true)) { " + goButton.getAttribute("oncommand") + "}");
						}
						else if (goButton.getAttribute("onclick")) {
							goButton.setAttribute("onclick","if (document.getElementById('"+urlbar.id+"').onTextEntered(true)) { " + goButton.getAttribute("onclick") + "}");
						}
						else {
							goButton.setAttribute("oncommand", "if (!document.getElementById('"+urlbar.id+"').onTextEntered(true)) { event.stopPropagation(); event.preventDefault(); return false; }");
						}
					}
				}
			}
		}
	},
	
	addAskFirstOption : function (e) {
		// Add the "Confirm" menuitem to the context menu
		var itemID = "url-fixer-askFirst";
		var itemLabel = this.strings.getString("urlfixer.askFirst");
		var itemOncommand = "URLFIXER.toggleAskFirst();";
		
		if ((e.originalTarget.localName == "menupopup") && (!document.getElementById(itemID))){
			var mi = document.createElement("menuitem");
			mi.setAttribute("id", itemID);
			mi.setAttribute("label", itemLabel);
			mi.setAttribute("type","checkbox");
			mi.setAttribute("checked",this.prefs.getBoolPref("askFirst"));
			mi.setAttribute("oncommand", itemOncommand);
			mi.setAttribute("accesskey", "r");
			
			e.originalTarget.appendChild(document.createElement("menuseparator"));
			e.originalTarget.appendChild(mi);
		}
	},
	
	toggleAskFirst : function () {
		this.prefs.setBoolPref("askFirst",!this.prefs.getBoolPref("askFirst"));
	},
	
	applyRE : function (string, re){
		if (!re.nomatch || !string.match(new RegExp(re.nomatch))){
			if (re.res){
				for (var i = 0; i < re.res.length; i++){
					string = URLFIXER.applyRE(string, re.res[i]);
				}
			}
			else {
				string = string.replace(new RegExp(re.find, "g"), re.replace);
			}
		}
		
		return string;
	}
};