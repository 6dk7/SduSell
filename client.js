const API = "http://localhost:3000/listings";

async function getListings() {
  const res = await fetch(API);
  console.log("GET /listings ->", res.status, await res.json());
}

async function postListing(title, price, seller) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, price: Number(price), seller })
  });
  console.log("POST /listings ->", res.status, await res.json());
}

async function main() {
  const [command, title, price, seller] = process.argv.slice(2);

  if (command === "get") {
    await getListings();
  } else if (command === "post") {
    if (!title || !price || !seller) {
      console.log('Usage: node client.js post "<title>" <price> <seller>');
      return;
    }
    await postListing(title, price, seller);
  } else {
    console.log("Usage:");
    console.log("  node client.js get");
    console.log('  node client.js post "<title>" <price> <seller>');
  }
}

main();
