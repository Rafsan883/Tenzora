import assert from "node:assert/strict";
import {
  parseSearchQuery,
  serializeSearchQuery,
  parseAndSerializeSearchQuery,
} from "../src/utils/searchQueryParser.js";

assert.deepEqual(parseSearchQuery("one piece"), {
  text: "one piece", filters: {}, invalidFilters: [],
});
assert.deepEqual(parseSearchQuery('"one piece" dub'), {
  text: "one piece", filters: { format: ["DUB"] }, invalidFilters: [],
});
assert.deepEqual(parseSearchQuery("movie airing genre:Action genre:Comedy"), {
  text: "", filters: { format: ["MOVIE"], status: "RELEASING", genre: ["Action", "Comedy"] }, invalidFilters: [],
});
assert.deepEqual(parseSearchQuery("naruto nonsense:value"), {
  text: "naruto", filters: {}, invalidFilters: ["nonsense"],
});

const original = {
  text: "one piece",
  filters: { format: ["DUB", "SUB"], genre: ["Action", "Comedy"], page: "2" },
};
const queryString = serializeSearchQuery(original);
assert.equal(queryString, "search=one+piece&format=DUB&format=SUB&genre=Action%2CComedy&page=2");
assert.deepEqual(parseAndSerializeSearchQuery(queryString).queryString, queryString);

console.log("searchQueryParser validation passed");