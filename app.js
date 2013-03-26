'use strict';

// Utility array method for filtering out duplicates
Array.prototype.uniq = function uniq() {
  return this.reduce(function(accum, cur) { 
    if (accum.indexOf(cur) === -1) accum.push(cur); 
    return accum; 
  }, [] );
}

// returns the first element of the array for which lambda(arr_element) is true.
Array.prototype.find = function find(lambda) {
  for (var i=0; i<this.length; i++)
    if ( lambda(this[i]) ) 
      return this[i];
  return -1;
}


// create module for custom directives
var d3DemoApp = angular.module('d3DemoApp', []);

// controller business logic
d3DemoApp.controller('AppCtrl', function AppCtrl ($scope, $http) {

  // initialize the model
  $scope.user = 'angular';
  $scope.repo = 'angular.js';

  // helper for formatting date
  var humanReadableDate = function (d) {
    return d.getUTCMonth() + '/' + d.getUTCDate();
  };

  // helper for reformatting the Github API response into a form we can pass to D3
  var reformatGithubResponse = function (data) {
    
    var MILLISECONDS_PER_DAY = 86400000;

    // sort the data by author date (rather than commit date)
    data.sort(function (a, b) { return (new Date(a.commit.author.date) > new Date(b.commit.author.date)) ? -1 : 1 });

    // date objects representing the first/last commit dates
    var date0 = new Date(data[data.length - 1].commit.author.date);
    var dateN = new Date(data[0].commit.author.date);

    // the number of days between the first and last commit
    var numDays = Math.floor((dateN - date0) / MILLISECONDS_PER_DAY) + 1;
    
    // array of every author name, without duplicates
    var uniqueAuthors = data.map(function(elm) {return elm.commit.author.name}).uniq();

    // what we'll finally be returning to d3
    // creates an array of all possible day objects for each author, initializing the commit counts (y) to 0
    var formattedData = uniqueAuthors.map(function(author) { 
      var allDays = d3.range(numDays).map(function(dayIndex) { return {x: dayIndex, y: 0} });
      allDays[0].user = author; // add the author's name to first record only
      return allDays;
    });

    // given an author commit date, get the day number in the timeline of all commits
    var dayIndexFromDate = function(d) { return Math.floor((new Date(d) - date0) / MILLISECONDS_PER_DAY); }

    // now we loop through the unformattedRecords, which each represent one commit, find the 
    // corrresponding formatted record, and increment its count (y) by 1.  We also add a date string
    // which will be used as a label.
    data.forEach(function(datum) {
      var curDayIndex = dayIndexFromDate(datum.commit.author.date);
      var curAuthorAllDays = formattedData.find(function(arr) { return arr[0].user === datum.commit.author.name });
      var dayToIncrement = curAuthorAllDays.find(function(day) { return day.x === curDayIndex });
      dayToIncrement.y += 1;
      dayToIncrement.date = humanReadableDate(new Date(datum.commit.author.date));
    });

    return formattedData;

  };

  $scope.getCommitData = function () {
    $http({
      method: 'GET',
      url:'https://api.github.com/repos/' +
        $scope.user +
        '/' +
        $scope.repo +
        '/commits'
    }).
    success(function (data) {
      // attach this data to the scope
      $scope.data = reformatGithubResponse(data);

      // clear the error messages
      $scope.error = '';
    }).
    error(function (data, status) {
      if (status === 404) {
        $scope.error = 'That repository does not exist';
      } else {
        $scope.error = 'Error: ' + status;
      }
    });
  };

  // get the commit data immediately
  $scope.getCommitData();
});


d3DemoApp.directive('ghVisualization', function () {

  // constants
  var margin = 20,
    width = 960,
    height = 500 - .5 - margin,
    color = d3.interpolateRgb("#f77", "#77f");

  return {
    restrict: 'E',
    terminal: true,
    scope: {
      val: '=',
      grouped: '='
    },
    link: function (scope, element, attrs) {

      // set up initial svg object
      var vis = d3.select(element[0])
        .append("svg")
          .attr("width", width)
          .attr("height", height + margin + 100);

      scope.$watch('val', function (newVal, oldVal) {

        // clear the elements inside of the directive
        vis.selectAll('*').remove();

        // if 'val' is undefined, exit
        if (!newVal) {
          return;
        }

        // Based on: http://mbostock.github.com/d3/ex/stack.html
        var n = newVal.length, // number of layers
            m = newVal[0].length, // number of samples per layer
            data = d3.layout.stack()(newVal);
        
        var mx = m,
            my = d3.max(data, function(d) {
              return d3.max(d, function(d) {
                return d.y0 + d.y;
              });
            }),
            mz = d3.max(data, function(d) {
              return d3.max(d, function(d) {
                return d.y;
              });
            }),
            x = function(d) { return d.x * width / mx; },
            y0 = function(d) { return height - d.y0 * height / my; },
            y1 = function(d) { return height - (d.y + d.y0) * height / my; },
            y2 = function(d) { return d.y * height / mz; }; // or `my` not rescale
        
        // Layers for each color
        // =====================

        var layers = vis.selectAll("g.layer")
            .data(data)
          .enter().append("g")
            .style("fill", function(d, i) {
              return color(i / (n - 1));
            })
            .attr("class", "layer");

        // Bars
        // ====
        
        var bars = layers.selectAll("g.bar")
            .data(function(d) { return d; })
          .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) {
              return "translate(" + x(d) + ",0)";
            });
        
        bars.append("rect")
            .attr("width", x({x: .9}))
            .attr("x", 0)
            .attr("y", height)
            .attr("height", 0)
          .transition()
            .delay(function(d, i) { return i * 10; })
            .attr("y", y1)
            .attr("height", function(d) {
              return y0(d) - y1(d);
            });

        // X-axis labels
        // =============

        var labels = vis.selectAll("text.label")
            .data(data[0])
          .enter().append("text")
            .attr("class", "label")
            .attr("x", x)
            .attr("y", height + 6)
            .attr("dx", x({x: .45}))
            .attr("dy", ".71em")
            .attr("text-anchor", "middle")
            .text(function(d, i) {
              return d.date;
            });

        // Chart Key
        // =========

        var keyText = vis.selectAll("text.key")
            .data(data)
          .enter().append("text")
            .attr("class", "key")
            .attr("y", function (d, i) {
              return height + 42 + 30*(i%3);
            })
            .attr("x", function (d, i) {
              return 155 * Math.floor(i/3) + 15;
            })
            .attr("dx", x({x: .45}))
            .attr("dy", ".71em")
            .attr("text-anchor", "left")
            .text(function(d, i) {
              return d[0].user;
            });

        var keySwatches = vis.selectAll("rect.swatch")
            .data(data)
          .enter().append("rect")
            .attr("class", "swatch")
            .attr("width", 20)
            .attr("height", 20)
            .style("fill", function(d, i) {
              return color(i / (n - 1));
            })
            .attr("y", function (d, i) {
              return height + 36 + 30*(i%3);
            })
            .attr("x", function (d, i) {
              return 155 * Math.floor(i/3);
            });


        // Animate between grouped and stacked
        // ===================================

        function transitionGroup() {
          vis.selectAll("g.layer rect")
            .transition()
              .duration(500)
              .delay(function(d, i) { return (i % m) * 10; })
              .attr("x", function(d, i) { return x({x: .9 * ~~(i / m) / n}); })
              .attr("width", x({x: .9 / n}))
              .each("end", transitionEnd);
        
          function transitionEnd() {
            d3.select(this)
              .transition()
                .duration(500)
                .attr("y", function(d) { return height - y2(d); })
                .attr("height", y2);
          }
        }

        function transitionStack() {
          vis.selectAll("g.layer rect")
            .transition()
              .duration(500)
              .delay(function(d, i) { return (i % m) * 10; })
              .attr("y", y1)
              .attr("height", function(d) {
                return y0(d) - y1(d);
              })
              .each("end", transitionEnd);
        
          function transitionEnd() {
            d3.select(this)
              .transition()
                .duration(500)
                .attr("x", 0)
                .attr("width", x({x: .9}));
          }
        }

        // reset grouped state to false
        scope.grouped = false;

        // setup a watch on 'grouped' to switch between views
        scope.$watch('grouped', function (newVal, oldVal) {
          // ignore first call which happens before we even have data from the Github API
          if (newVal === oldVal) {
            return;
          }
          if (newVal) {
            transitionGroup();
          } else {
            transitionStack();
          }
        });
      });
    }
  }
});

