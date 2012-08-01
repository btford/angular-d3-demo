## AngularJS + D3.js = ♥
An example of how to write an AngularJS directive that uses the D3.js visualization library. I walk through [building this app on my blog](http://briantford.com/blog/angular-d3.html).

## Running it
Github's Content Security Policy forbids making requests from `file://`, so you'll need to host the app locally. The easiest way to do this is to launch a simple python server from the directory:

    python -m SimpleHTTPServer

If you want to host this application somewhere, note that you have to register the application so it can use the Github API: https://github.com/settings/applications