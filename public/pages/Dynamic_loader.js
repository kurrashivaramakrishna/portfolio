// function loadPage(page) {
//   fetch(page)
//     .then(response => {
//       if (!response.ok) throw new Error("Page not found");
//       return response.text();
//     })
//     .then(html => {
//       document.getElementById('content').innerHTML = html;
//       window.history.pushState({}, "", page);
//     })
//     .catch(err => {
//       document.getElementById('content').innerHTML = "<h2>Page not found</h2>";
//     });
// }

// window.onpopstate = () => {
//   const page = location.pathname.replace("/", "") || "signin.html";
//   loadPage(page);
// };

// window.onload = () => {
//   const page = location.pathname.replace("/", "") || "signin.html";
//   loadPage(page);
// };
