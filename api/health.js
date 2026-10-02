import { endpoint, services } from "../server/platform.js";
export default endpoint(["GET"], async () => {
  await services().db.doc("accessPolicy/public").get();
  return { status: "ok" };
});
