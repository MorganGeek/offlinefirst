(function () {
  "use strict";


  // Make sure we are accessing over https, if not redirect
  if ((!location.port || location.port === "80") && location.protocol !== "https:" && location.host !== "localhost") {
    location.protocol = "https:";
  }


  // Register our ServiceWorker
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/offlinefirst/worker.js", {
      scope: "/offlinefirst/"
    }).then(function (reg) {
      console.log("SW register success", reg);
    }, function (err) {
      console.log("SW register fail", err);
    });
  }

  // localStorage keys
  var lsHistoryID = "offlinefirst-ls-history";


  // DOM references
  var historyContainer = document.querySelector(".history");
  var historyNone = document.querySelector(".history .empty-list");
  var historyButton = document.querySelector(".history-button");
  var historyClear = document.querySelector(".history-clear");

  var suggestionsContainer = document.querySelector(".suggestions");
  var suggestionsNone = document.querySelector(".suggestions .empty-list");
  var suggestionsLoading = document.querySelector(".suggestions-loading");

  var articleContent = document.querySelector(".article-content");
  var articleTitle = document.querySelector(".article-title");
  var articleLink = document.querySelector(".article-link");
  var articleLoading = document.querySelector(".article-loading");

  var searchForm = document.querySelector(".search");
  var searchBox = searchForm.querySelector("[name=query]");

  // options
  var optHistorySize = 10;


  // Enable/disable search functionality based on network availability
  function updateNetworkStatus() {
    searchBox.value = "";

    if (navigator.onLine) {
      searchBox.removeAttribute("disabled");
      searchBox.setAttribute("placeholder", "Search");
    } else {
      closeSuggestions();
      searchBox.setAttribute("disabled", "disabled");
      searchBox.setAttribute("placeholder", "No connection - try history");
    }
  }


  // History button was clicked
  function clickHistoryButton(event) {
    event.preventDefault();

    if (searchForm.classList.contains("history-open")) {
      closeHistory();
    } else {
      openHistory();
    }
  }


  // Open history list
  function openHistory() {
    closeSuggestions();
    searchForm.classList.add("history-open");
  }


  // Close history list
  function closeHistory() {
    searchForm.classList.remove("history-open");
  }


  // Open suggestions list
  function openSuggestions() {
    closeHistory();
    suggestionsContainer.classList.add("suggestions-open");
  }


  // Close suggestions list
  function closeSuggestions() {
    suggestionsContainer.classList.remove("suggestions-open");
  }


  // Show suggestions loading icon
  function showsuggestionsLoading() {
    suggestionsLoading.classList.add("show");
  }


  // Hide suggestions loading icon
  function hidesuggestionsLoading() {
    suggestionsLoading.classList.remove("show");
  }

  //listen for clicks outside history/suggestions divs and close if necessary
  function windowClick(event) {
    if ( !historyContainer.contains(event.target) && !suggestionsContainer.contains(event.target) &&
        !historyButton.contains(event.target) ) {

      closeHistory();
      closeSuggestions();

      }
  }

  // Show article loading icon
  function showArticleLoading() {
    articleLoading.classList.add("show");
  }


  // Hide article loading icon
  function hideArticleLoading() {
    articleLoading.classList.remove("show");
  }


  // A link to an article was clicked
  function clickArticle(event) {
    if (event.target.classList.contains("article-load")) {
      event.preventDefault();

      var query = event.target.dataset.query;
      find(query);

      closeHistory();
      closeSuggestions();
    } else if (event.target.classList.contains("history-clear")) {
      event.preventDefault();

      clearHistory();
    }
  }


  // Update history list
  function updateHistory() {
    var link;
    var history = localStorage.getItem(lsHistoryID);
    var historyList = historyContainer.querySelector(".history-list");

    historyList.innerHTML = "";

    if (history) {
      history = JSON.parse(history);

      if (history.length) {
        historyNone.classList.remove("show");
        historyClear.classList.add("show");

        history.reverse();
        history.forEach(function (query) {

          link = document.createElement("a");
          link.textContent = query;
          link.setAttribute("href", "#");
          link.setAttribute("data-query", query);
          link.setAttribute("class", "article-load");

          historyList.appendChild(link);
        });

      } else {
        historyNone.classList.add("show");
        historyClear.classList.remove("show");
      }

    } else {
      historyNone.classList.add("show");
      historyClear.classList.remove("show");
    }
  }

  function clearHistory() {
    localStorage.setItem(lsHistoryID, JSON.stringify([]));
    closeHistory();
    updateHistory();
  }


  // Save an article to the history
  function saveArticle(title) {
    var history = localStorage.getItem(lsHistoryID);

    if (history) {
      history = JSON.parse(history);
    } else {
      history = [];
    }

    if (history.indexOf(title) === -1) {

      if (history.length >= optHistorySize) {
        history.shift();
      }
      history.push(title);
    }

    localStorage.setItem(lsHistoryID, JSON.stringify(history));

    updateHistory();
  }


  // Search form was sumitted
  function submitSearchForm(event) {
    event.preventDefault();

    search(event.currentTarget.query.value);
  }


  // Search wikipedia for the search query
  function search(query) {
    closeHistory();

    if (query) {
      suggestionsNone.classList.remove("show");

      var suggestions;
      var link;
      var suggestionsList = suggestionsContainer.querySelector(".suggestions-list");

      suggestionsList.innerHTML = "";
      showsuggestionsLoading();
      openSuggestions();

      jsonp("//en.wikipedia.org/w/api.php", {
        format: "json",
        action: "opensearch",
        search: query,
        limit: 5,
        titles: query
      }, function (response) {
        hidesuggestionsLoading();

        suggestions = response[1];

        if (suggestions.length === 0) {

          suggestionsNone.classList.add("show");

        } else {

          if (suggestions.length === 1) {

            closeSuggestions();
            find(suggestions[0]);

          } else {

            suggestions.forEach(function (suggestion) {
              link = document.createElement("a");
              link.textContent = suggestion;
              link.setAttribute("href", "#");
              link.setAttribute("data-query", suggestion);
              link.setAttribute("class", "article-load");
              suggestionsList.appendChild(link);
            });

          }
        }

      }, function (err) {
        hidesuggestionsLoading();

        console.log("error", err);
      });
    } else {
      closeSuggestions();
    }
  }


  // Find an article on Wikipedia
  function find(title) {
    var page, extract, titleText, thumb, img, url, link;

    articleContent.innerHTML = "";
    articleTitle.innerHTML = "";
    articleLink.innerHTML = "";
    showArticleLoading();

    jsonp("//en.wikipedia.org/w/api.php", {
      format: "json",
      action: "query",
      continue: "",
      prop: "extracts|pageimages",
      exsentences: 10,
      exlimit: 1,
      explaintext: true,
      piprop: "thumbnail",
      pithumbsize: 200,
      redirects: true,
      titles: title
    }, function (response) {
      hideArticleLoading();

      console.log("success", response);

      page;
      for(var pageId in response.query.pages) {
        page = response.query.pages[pageId];
      }

      extract = page.extract;
      titleText = page.title;
      thumb = false;

      if (page.thumbnail && page.thumbnail.source) {
        thumb = page.thumbnail.source;
      }

      if (!extract) {
        extract = "No matching article";
      } else {
        saveArticle(titleText);
      }

      if (thumb) {
        img = document.createElement("img");
        img.setAttribute("src", thumb);
        img.setAttribute("class", "thumb");
        articleContent.appendChild(img);
      }

      articleContent.innerHTML += extract;
      articleTitle.textContent = titleText;

      url = "http://en.wikipedia.org/wiki/" + titleText;
      link = document.createElement("a");
      link.textContent = url;
      link.setAttribute("href", url);
      link.setAttribute("target", "_blank");
      articleLink.appendChild(link);

    }, function (err) {
      hideArticleLoading();

      console.log("error", err);
    });
  }


  // Make a JSON-P request
  function jsonp(url, data, callback, onerror) {
    var callbackName = "jsonp_callback";

    var script = document.createElement("script");
    script.src = url + "?" + getParams(data) + "&callback=" + callbackName;
    script.onerror = onerror;

    window[callbackName] = function (data) {
      delete window[callbackName];
      document.body.removeChild(script);
      callback(data);
    };

    document.body.appendChild(script);
  }


  // form a GET query string from object
  function getParams(obj) {
    var str = "";
    for (var key in obj) {
        if (str !== "") {
            str += "&";
        }
        str += key + "=" + encodeURIComponent(obj[key]);
    }

    return str;
  }

  /**
 * A lightweight game wrapper
 *
 * @constructor
 */
function Game(canvas, options) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');

    this.score = 0;
    this.key = 'right';
    this.entities = [];

    this.options = {
        fps: 15
    };

    if (options) {
        for (var i in options) this.options[i] = options[i];
    }
    
    this.scale();
}


/**
 * Start the game loop
 * and initialize the keybindings
 */
Game.prototype.start = function () {
    this.keyBindings();
    this.gameLoop();
};


/**
 * Stop the game loop
 */
Game.prototype.stop = function() {
    this.pause = true;
};


/**
 * Scale the canvas element
 * in accordance with the correct ratio
 */
Game.prototype.scale = function () {
    this.ratio = innerWidth < innerHeight ? innerWidth : innerHeight;
    this.tile = (this.ratio / 20) | 0;
    this.grid = this.ratio / this.tile;

    this.canvas.width = this.canvas.height = this.ratio;
};


/**
 * Adds an entity to the game
 *
 * @param {Function} entity
 */
Game.prototype.addEntity = function (entity) {
    this.entities.push(entity);
};


/**
 * Determines if an entity collides with another
 *
 * @param {Object} a
 * @param {Object} b
 */
Game.prototype.collide = function(a, b){
    return a.x === b.x && a.y === b.y;
};


/**
 * Tracks the pressed keys
 */
Game.prototype.keyBindings = function () {
    var that = this;

    // define some keys
    var keys = {
        a: 65,
        left: 37,
        d: 68,
        right: 39,
        w: 87,
        up: 38,
        s: 83,
        down: 40
    };


    /**
     * Attach keyboard arrows to snake direction
     */
    document.onkeydown = function (e) {
        switch ((e.which || e.keyCode) | 0) {
            case keys.a:
            case keys.left:
                if (that.key !== 'right') that.key = 'left';
                break;

            case keys.d:
            case keys.right:
                if (that.key !== 'left') that.key = 'right';
                break;

            case keys.w:
            case keys.up:
                if (that.key !== 'down') that.key = 'up';
                break;

            case keys.s:
            case keys.down:
                if (that.key !== 'up') that.key = 'down';
        }
    };

};


/**
 * The gameloop - and entity (update/draw) calls
 * Use of `setTimeout` instead of animationFrame
 * in order to keep it simple as possible
 */
Game.prototype.gameLoop = function () {
    if(this.pause) return;

    var self = this,
        ctx = this.context;

    // clear the view area
    ctx.fillStyle = "#123";

    // add some blur
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // disable blur
    ctx.globalAlpha = 1;

    var i = this.entities.length;

    while(i--) {
        var entity = this.entities[i];
        if(entity.update) entity.update();
        if(entity.draw) entity.draw(ctx);
    }
    

    setTimeout(function(){
        self.gameLoop()
    }, 1000 / this.options.fps);
};



/**
 * The whole snake things
 *
 * @constructor
 */
function Snake(game, food){
    var tile = game.tile;
    var grid = game.grid;
    var collide = game.collide;

    this.x = 4;
    this.y = 4;
    this.segments = [];

    this.update = function() {

        // change direction -depending on which key was pressed
        if(game.key === 'left') this.x--;
        if(game.key === 'right') this.x++;
        if(game.key === 'up') this.y--;
        if(game.key === 'down') this.y++;

        // boundaries
        this.x = (this.x + tile) % tile;
        this.y = (this.y + tile) % tile;
        
        /**
         * check snake-food collision
         */
        if (game.collide(this, food)) {

            // randomize point position
            food.x = food.y = Math.random() * tile | 0;
            
            // each 5th cake count up the score and increase the speed
            if (!((game.score += 10) % 50)) {
                game.options.fps += 5;
            }
            
        } else {
            // remove last segment if snake
            // didn't got a point in this turn
            if (this.segments.length) this.segments.pop();
        }
        
        
        // push next x and y to the beginning of segments
        this.segments.unshift({x:this.x, y:this.y});
        
        /**
         * check collision with snake itself - skipping the head (`--i` instead of `i--`)
         */
        var i = this.segments.length;
        while (--i) {
            if(game.collide(this, this.segments[i])) {
                // break the loop and slice the worm in point of intersection
                // here's in reality gameover...
                // game.stop();
                return this.segments.splice(i);
            }
        }
 
    };
    
    this.draw = function(ctx) {
        // draw rectangle for each segment
        // head gets another color
        var i = this.segments.length;
        while (i--) {
            var segment = this.segments[i];
            ctx.fillStyle = !i ? '#0cf' : '#0ae';
            ctx.fillRect(
            segment.x * grid,
            segment.y * grid,
            grid, grid);
        }
    };
}


/**
 * The whole things to eat
 *
 * @constructor
 */
function Food(game){
    var grid = game.grid;

    this.x = 4;
    this.y = 4;

    this.draw = function(ctx){
        ctx.fillStyle = "#f05";
        ctx.fillRect(this.x * grid, this.y * grid, grid, grid);
    };
}





  function startGame() {
// create the canvas element
var canvas = document.createElement("canvas");
document.body.appendChild(canvas);

/**
 * Game initialization
 * and entity preparation
 */
var game = new Game(canvas);
var food = new Food(game);
var snake = new Snake(game, food);

game.addEntity(food);
game.addEntity(snake);
game.start(); 
  }

  // Event listeners
  /*historyContainer.addEventListener("click", clickArticle);
  suggestionsContainer.addEventListener("click", clickArticle);
  searchForm.addEventListener("submit", submitSearchForm);
  historyButton.addEventListener("click", clickHistoryButton);
  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  window.addEventListener("click", windowClick);


  // Initialisation
  updateHistory();
  updateNetworkStatus();*/
  startGame();

}());
