const http = require("http");
const fs = require("fs");
const path = require("path");

http
  .createServer((request, response) => {
    let filePath = "./docs" + request.url;
    if (filePath === "./docs/") filePath = "./docs/index.html";

    console.log(filePath);

    const extname = path.extname(filePath);
    let contentType = "text/html";
    switch (extname) {
      case ".js":
        contentType = "text/javascript";
        break;
      case ".css":
        contentType = "text/css";
        break;
    }

    fs.readFile(filePath, function (error, content) {
      if (error) {
        if (error.code == "ENOENT") {
          response.writeHead(404);
          response.end();
        } else {
          response.writeHead(500);
          response.end();
        }
      } else {
        response.writeHead(200, { "Content-Type": contentType });
        response.end(content, "utf-8");
      }
    });
  })
  .listen(3000);

console.log("Server running at http://127.0.0.1:3000/");
