import app from "../apps/api/src/app.js";

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.searchParams.get("__mesh_path");
    if (path) {
      url.pathname = `/${path}`;
      url.searchParams.delete("__mesh_path");
    }
    return app.fetch(new Request(url, request));
  },
};
