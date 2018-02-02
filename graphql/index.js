const { GraphQLServer } = require("graphql-yoga");
const mongo = require("mongodb");

async function main() {
  const url = "mongodb://localhost:27017";
  const client = await mongo.MongoClient.connect(url);
  const db = client.db("gc");
  const collection = db.collection("gcs");

  const typeDefs = `
  type Query {
    hello(name: String): String!
    geocaches: [Geocache]
    geocache(gc: String): Geocache
  }

  type Geocache {
    gc: String!
    parsed_date: String
    coord_date: String
    coord: Coord
  }

  type Coord {
    lat: Float!
    lon: Float!
  }
`;

  const resolvers = {
    Query: {
      hello: (_, { name }) => `Hello ${name || "World"}`,
      geocaches: async () => {
        var res = await collection.find({
          coord: { $exists: true },
          "parsed.premium": false
        });
        return await res.toArray();
      },
      geocache: async (_, { gc }) => {
        var res = await collection.find({ gc }).limit(1);
        if (await res.hasNext()) {
          return await res.next();
        } else {
          return null;
        }
      }
    }
  };

  const server = new GraphQLServer({ typeDefs, resolvers });
  server.start(() => console.log("Server is running on localhost:4000"));
}

main();
