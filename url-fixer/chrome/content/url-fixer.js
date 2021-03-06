var URLFIXER = {
	plusCompatible : true,
	
	/**
	 * Lazy strings getter.
	 */
	
	strings : {
		_backup : null,
		_main : null,

		initStrings : function () {
			if (!this._backup) { this._backup = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://url-fixer-default-locale/content/locale.properties"); }
			if (!this._main) { this._main = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).createBundle("chrome://url-fixer/locale/locale.properties"); }
		},

		getString : function (key) {
			this.initStrings();

			var rv = "";

			try {
				rv = this._main.GetStringFromName(key);
			} catch (e) {
			}

			if (!rv) {
				try {
					rv = this._backup.GetStringFromName(key);
				} catch (e) {
				}
			}

			return rv;
		},

		getFormattedString : function (key, args) {
			this.initStrings();

			var rv = "";

			try {
				rv = this._main.formatStringFromName(key, args, args.length);
			} catch (e) {
			}

			if (!rv) {
				try {
					rv = this._backup.formatStringFromName(key, args, args.length);
				} catch (e) {
				}
			}

			return rv;
		}
	},
	
	typedItCollector : {
		handlerId : "urlfixer",
		pathToResources : "chrome://url-fixer/content/typedit/",
		
		prefs : null,
		
		domains : [],
		privateBrowsingService : null,
		domainCollectionTimer : null,
		
		privateBrowsingEnabled : function () {
			if (!this.privateBrowsingService) {
				this.privateBrowsingService = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
			}

			return this.privateBrowsingService.privateBrowsingEnabled;
		},
		
		load : function () {
			this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.typed-it-collection.");
			this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
			this.prefs.addObserver("", this, false);
			
			this.prefs.setCharPref("handler", this.handlerId);
			
			document.addEventListener("TypedItCollectorAllow", this.optInAccept, false, true);
			document.addEventListener("TypedItCollectorDeny", this.optInCancel, false, true);
			
			this.observe("ignoreThisArgument", "nsPref:changed", "domainOptIn");
		},
		
		unload : function () {
			this.prefs.removeObserver("", this);
			
			if (this.prefs.getCharPref("handler") == this.handlerId) {
				var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService)
				try { idleService.removeIdleObserver(this, 60); } catch (notObserving) { }
			
				clearTimeout(this.domainCollectionTimer);
			}
			
			document.removeEventListener("TypedItCollectorAllow", this.optInAccept, false, true);
			document.removeEventListener("TypedItCollectorDeny", this.optInCancel, false, true);
		},
		
		observe : function (subject, topic, data) {
			var self = URLFIXER.typedItCollector;
			
			if (topic === "nsPref:changed") {
				switch(data) {
					case "domainOptIn":
						if (self.prefs.getCharPref("handler") == self.handlerId) {
							try {
								self.domainCollectionTimer.cancel();
							} catch (notActive) { }
							
							var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService)
							
							if (!self.prefs.getBoolPref("domainOptIn")) {
								try {
									idleService.removeIdleObserver(self, 60);
								} catch (notObserving) { }

								self.domains = [];

								self.privateBrowsingService = null;

								self.prefs.setIntPref("optedOutTimestamp", Math.round((new Date()).getTime() / 1000));
							}
							else {
								// Save domain data every 15 minutes, or whenever the user is idle for 60 seconds.
								self.domainCollectionTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
								self.domainCollectionTimer.initWithCallback(self, 1000 * 60 * 15, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
							
								self.privateBrowsingService = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
							
								idleService.addIdleObserver(self, 60);
							
								self.prefs.setBoolPref("domainOptInAsk", true);
								self.prefs.setIntPref("optedOutTimestamp", 0);
								self.prefs.setBoolPref("initialized", true);
							}
						}
					break;
					case "domainOptInAsk":
						if (self.prefs.getCharPref("handler") == self.handlerId) {
							self.prefs.setBoolPref("initialized", true);
						}
					break;
					case "handler":
						var idleService = Components.classes["@mozilla.org/widget/idleservice;1"].getService(Components.interfaces.nsIIdleService)
						
						if (self.prefs.getCharPref("handler") == self.handlerId) {
							// We're now the handler.
							if (self.prefs.getBoolPref("domainOptIn")) {
								// Save domain data every 15 minutes, or whenever the user is idle for 60 seconds.
								self.domainCollectionTimer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
								self.domainCollectionTimer.initWithCallback(self, 1000 * 60 * 15, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);
								
								self.privateBrowsingService = Components.classes["@mozilla.org/privatebrowsing;1"].getService(Components.interfaces.nsIPrivateBrowsingService);
								
								idleService.addIdleObserver(self, 60);
							}
						}
						else {
							// We're now not the handler.
							try {
								self.domainCollectionTimer.cancel();
							} catch (notActive) { }
							
							try {
								idleService.removeIdleObserver(self, 60);
							} catch (notObserving) { }
							
							self.domains = [];
							
							self.privateBrowsingService = null;
						}
					break;
				}
			}
			else if (topic === "idle") {
				self.anonymousDataCollection();
			}
		},
		
		firstRun : function () {
			var self = URLFIXER.typedItCollector;
		
			if (typeof Browser === 'undefined') { // Don't do anything for Mobile.
				if (self.prefs.getCharPref("handler") == self.handlerId) {
					var counter = self.prefs.getIntPref("counter");
				
					if (counter < 5) {
						counter++;
				
						self.prefs.setIntPref("counter", counter);
					}
					else if (!self.prefs.getBoolPref("domainOptInAsk") && !self.prefs.getBoolPref("domainOptIn")) {
						self.requestOptIn();
					}
				}
			}
		},
		
		requestOptIn : function () {
			var self = URLFIXER.typedItCollector;
			
			window.openDialog(self.pathToResources + "optIn.xul", "typedItOptIn", "chrome,dialog,centerscreen,titlebar");
		},

		optInAccept : function () {
			var self = URLFIXER.typedItCollector;
			
			self.prefs.setBoolPref("domainOptInAsk", true);
			self.prefs.setBoolPref("domainOptIn", true);
		},

		optInCancel : function () {
			var self = URLFIXER.typedItCollector;
			
			self.prefs.setBoolPref("domainOptInAsk", true);
			self.prefs.setBoolPref("domainOptIn", false);
		},

		optInDisclosure : function () {
			var self = URLFIXER.typedItCollector;
			
			if (typeof Browser != 'undefined' && typeof Browser.addTab != 'undefined') {
				Browser.addTab("http://data-" + self.handlerId + ".efinke.com/", true);
			}
			else {
				var browser = getBrowser();
				browser.selectedTab = browser.addTab("http://data-" + self.handlerId + ".efinke.com/");
			}
		},
		
		processDomain : function (typedDomain) {
			var self = URLFIXER.typedItCollector;
			
			if (self.prefs.getBoolPref("domainOptIn") && self.prefs.getCharPref("handler") == self.handlerId && !self.privateBrowsingEnabled()) {
				if (typedDomain.indexOf("//") != -1) {
					typedDomain = typedDomain.split("//")[1];
				}
				
				if (typedDomain.indexOf("about:") === -1 && typedDomain.indexOf(".") !== -1 && typedDomain.indexOf("@") === -1) {
					self.domains.push(typedDomain.toLowerCase());
				}
			}
		},
		
		/**
		 * nsITimer callback.
		 */
		
		notify : function (timer) {
			var self = URLFIXER.typedItCollector;
			
			self.anonymousDataCollection();
		},
		
		anonymousDataCollection : function () {
			var self = URLFIXER.typedItCollector;
			
			if (self.prefs.getCharPref("handler") == self.handlerId) {
				if (self.domains.length > 0 && self.prefs.getBoolPref("domainOptIn")) {
					var argString = "";
					
					self.domains.forEach(function (el) {
						argString += "domains[]=" + encodeURIComponent(el) + "&";
					});
					
					argString += "app=" + self.handlerId;
					
					var theseDomains = self.domains;
					self.domains = [];
					
					var req = new XMLHttpRequest();
					req.open("POST", "http://data-" + self.handlerId + ".efinke.com/", true);
					req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
					req.setRequestHeader("Content-Length", argString.length);
					
					req.onreadystatechange = function () {
						if (req.readyState == 4) {
							if (req.status != 200) {
								self.domains = self.domains.concat(theseDomains);
							}
						}
					};
					
					req.send(argString);
				}
			}
		}
	},
	
	load : function () {
		removeEventListener("load", URLFIXER.load, false);
		
		function doit() {
			// Add our typo-fixing function to the URL bar
			URLFIXER.addTypoFixer();
			
			// Listen for manual preference changes
			URLFIXER.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.url-fixer.");
			URLFIXER.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
			URLFIXER.prefs.addObserver("", URLFIXER, false);
			
			URLFIXER.typedItCollector.load();
			
			// Initialize the new shared prefs so we don't bug the user twice.
			if (!URLFIXER.typedItCollector.prefs.getBoolPref("initialized") && !URLFIXER.typedItCollector.prefs.getBoolPref("domainOptInAsk") && URLFIXER.prefs.getBoolPref("domainOptInAsk")) {
				URLFIXER.typedItCollector.prefs.setBoolPref("initialized", true);
				URLFIXER.typedItCollector.prefs.setBoolPref("domainOptInAsk", true);
				URLFIXER.typedItCollector.prefs.setBoolPref("domainOptIn", URLFIXER.prefs.getBoolPref("domainOptIn") || URLFIXER.typedItCollector.prefs.getBoolPref("domainOptIn"));
				
				if (URLFIXER.typedItCollector.prefs.getBoolPref("domainOptInAsk") && URLFIXER.typedItCollector.prefs.getBoolPref("domainOptIn")) {
					URLFIXER.typedItCollector.prefs.setIntPref("optedOutTimestamp", Math.round((new Date()).getTime() / 1000));
				}
			}
			
			document.addEventListener("URLFixerNetErrorCorrection", URLFIXER.netErrorCorrection, false, true);
			
			addEventListener("unload", URLFIXER.unload, false);
			
			setTimeout(URLFIXER.showFirstRun, 3000);
		}
		
		if (typeof URLFIXERPLUS != 'undefined') {
			// URL Fixer Plus has already been initialized.
			return;
		}
		
		// Also check if URL Fixer Plus is installed and enabled, just in case it hasn't been initialized yet.
		if ("@mozilla.org/extensions/manager;1" in Components.classes) {
			var em = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
			var item = em.getItemForID("url-fixer-plus@efinke.com");
			
			if (!item) {
				doit();
			}
		}
		else {
			Components.utils.import("resource://gre/modules/AddonManager.jsm");
			
			AddonManager.getAddonByID("url-fixer-plus@efinke.com", function (addon) {
				if (!addon || addon.userDisabled || addon.appDisabled || !addon.isActive) {
					doit();
				}
			});
		}
	},
	
	unload : function () {
		removeEventListener("unload", URLFIXER.unload, false);
		
		URLFIXER.prefs.removeObserver("", URLFIXER);
		
		URLFIXER.typedItCollector.unload();
	},
	
	observe: function(subject, topic, data) {
		if (topic === "nsPref:changed") {
			switch(data) {
				case "askFirst":
					// Update the checked property on the URL bar's context menu.
					if (document.getElementById("url-fixer-askFirst")){
						document.getElementById("url-fixer-askFirst").setAttribute("checked", URLFIXER.prefs.getBoolPref("askFirst"));
					}
				break;
			}
		}
	},
	
	getJSONPref : function (prefName, defaultValue) {
		var rv = URLFIXER.prefs.getComplexValue(prefName, Components.interfaces.nsISupportsString).data;
		
		if (!rv) {
			return defaultValue;
		}
		else {
			try {
				return JSON.parse(rv);
			} catch (e) {
				return defaultValue;
			}
		}
	},
	
	setJSONPref : function (prefName, prefVal) {
		var stringPrefVal = JSON.stringify(prefVal);
		
		var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
		str.data = stringPrefVal;

		try {
			URLFIXER.prefs.setComplexValue(prefName, Components.interfaces.nsISupportsString, str);
		} catch (e) {
			URLFIXER.log(e);
		}
	},
	
	netErrorCorrection : function (evt) {
		var button = evt.target;
		var oldUrl = button.getAttribute("old");
		var newUrl = button.getAttribute("new");
		
		if (newUrl.indexOf("http://") == -1 && newUrl.indexOf("https://") == -1) {
			newUrl = oldUrl.split("//")[0] + "//" + newUrl;
		}
		
		var rv = newUrl;
		
		var oldParts = oldUrl.split("://");
		var newParts = newUrl.split("://");
		
		// Discard the protocol if they're the same.
		if (oldParts[0] == newParts[0]) {
			oldParts.shift();
			newParts.shift();
			oldUrl = "//" + oldParts.join("//");
			newUrl = "//" + newParts.join("//");
		}
		
		// Ignore www subdomain if both of them have it.
		if (oldUrl.indexOf("//www.") != -1 && (oldUrl.indexOf("//www.") === newUrl.indexOf("//www."))) {
			oldUrl = oldUrl.split("//www.")[1];
			newUrl = newUrl.split("//www.")[1];
		}
		
		// Ignore trailing slashes
		if (oldUrl.charAt(oldUrl.length - 1) == "/" && newUrl.charAt(newUrl.length - 1) == "/") {
			oldUrl = oldUrl.substr(0, oldUrl.length - 1);
			newUrl = newUrl.substr(0, newUrl.length - 1);
		}
		
		var corrections = URLFIXER.getJSONPref("custom_replace", {});
		corrections[oldUrl] = newUrl;
		URLFIXER.setJSONPref("custom_replace", corrections);
		
		content.location.href = rv;
	},
	
	getVersion : function (callback) {
		var addonId = "{0fa2149e-bb2c-4ac2-a8d3-479599819475}";
		
		if ("@mozilla.org/extensions/manager;1" in Components.classes) {
			// < Firefox 4
			var version = Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager).getItemForID(addonId).version;
			
			callback(version);
		}
		else {
			// Firefox 4.
			Components.utils.import("resource://gre/modules/AddonManager.jsm");  
			
			AddonManager.getAddonByID(addonId, function (addon) {
				callback(addon.version);
			});
		}
	},
	
	showFirstRun : function () {
		function isMajorUpdate(version1, version2) {
			if (version1 == version2) {
				return false;
			}
			
			if (!version1) {
				return true;
			}
			else {
				var oldParts = version1.split(".");
				var newParts = version2.split(".");
				
				if (newParts[0] != oldParts[0] || newParts[1] != oldParts[1]) {
					return true;
				}
			}
			
			return false;
		}
		
		function isUpdate() {
			return URLFIXER.prefs.getCharPref("version");
		}
		
		function doShowFirstRun(version) {
			if (isMajorUpdate(URLFIXER.prefs.getCharPref("version"), version)) {
				if (typeof Browser != 'undefined' && typeof Browser.addTab != 'undefined') {
					// Browser.addTab("http://www.chrisfinke.com/firstrun/url-fixer.php?v=" + version, true);
					// No firstrun on Fennec.
				}
				else {
					var browser = getBrowser();
					browser.selectedTab = browser.addTab("http://www.chrisfinke.com/firstrun/url-fixer.php?v=" + version + (isUpdate() ? "&update=1" : ""));
				}
			}
			
			URLFIXER.prefs.setCharPref("version", version);
			
			URLFIXER.typedItCollector.firstRun();
		}
		
		URLFIXER.getVersion(doShowFirstRun);
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
						
						if (typeof getShortcutOrURI != 'undefined') {
							if (getShortcutOrURI(this.value, {}) != this.value) {
								goAhead = false;
							}
						}
					}
					
					if (goAhead) {
						if (this.value.indexOf("moz-action:") == 0) {
							goAhead = false;
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
							{find: "^w{2,4}(\\.)([^\\.]+\\..*)$", "replace" : "www.$2"},
							{find: "//ww(\\.)([^\\.]+\\..*)$", "replace" : "//www.$2"},
						
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
					
						var custom_res = URLFIXER.getJSONPref("custom_replace", {});
						
						var fullUrl = this.value;
						
						// Apply all of the RE changes listed above
						for (var i in custom_res) {
							if (i.indexOf("re:") == 0) {
								var replacement_object = {
									"find" : i.replace(/^re:+/g, ""),//.replace(/\\/g, "\\\\"),
									"replace" : custom_res[i]
								};
								
								fullUrl = URLFIXER.applyRE(fullUrl, replacement_object);
							}
							else {
								fullUrl = fullUrl.replace(i, custom_res[i]);
							}
						}
						
						this.value = fullUrl;
					
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
						
						URLFIXER.typedItCollector.processDomain(oldValue);
						
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
										
										// Consider this a 2nd typed domain.
										URLFIXER.typedItCollector.processDomain(urlValue);
									}
								}
							}
							else {
								// No confirmation needed
								this.value = urlValue;
								
								// Consider this a 2nd typed domain.
								URLFIXER.typedItCollector.processDomain(urlValue);
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
		var itemLabel = URLFIXER.strings.getString("urlfixer.askFirst");
		var itemOncommand = "URLFIXER.toggleAskFirst();";
		
		if ((e.originalTarget.localName == "menupopup") && (!document.getElementById(itemID))){
			var mi = document.createElement("menuitem");
			mi.setAttribute("id", itemID);
			mi.setAttribute("label", itemLabel);
			mi.setAttribute("type","checkbox");
			mi.setAttribute("checked",URLFIXER.prefs.getBoolPref("askFirst"));
			mi.setAttribute("oncommand", itemOncommand);
			mi.setAttribute("accesskey", "r");
			
			e.originalTarget.appendChild(document.createElement("menuseparator"));
			e.originalTarget.appendChild(mi);
		}
	},
	
	toggleAskFirst : function () {
		URLFIXER.prefs.setBoolPref("askFirst",!URLFIXER.prefs.getBoolPref("askFirst"));
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