const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xgh8h2c.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    const brandCollection = client.db("houteHorology").collection("brands");
    app.get("/brands", async (req, res) => {
      const query = {};
      const brands = await brandCollection.find(query).toArray();
      res.send(brands);
    });
  } finally {
  }
};
run().catch(console.log);

app.get("/", (req, res) => {
  res.send("luxury watch server");
});
app.listen(port, () => {
  console.log(`houte horology server is running on port ${port}`);
});
