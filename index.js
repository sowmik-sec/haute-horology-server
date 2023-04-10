const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.xgh8h2c.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("unauthorized access");
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    const brandCollection = client.db("houteHorology").collection("brands");
    const userCollection = client.db("houteHorology").collection("users");
    const watchCollection = client.db("houteHorology").collection("watches");
    const orderCollection = client.db("houteHorology").collection("orders");
    const paymentsCollection = client
      .db("houteHorology")
      .collection("payments");

    // NOTE: make sure you use verifyAdmin after verifyJWT
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      if (user.isAdmin !== true) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await userCollection.findOne(query);
      if (user.role !== "seller") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };
    app.get("/brands", async (req, res) => {
      const query = {};
      const brands = await brandCollection.find(query).toArray();
      res.send(brands);
    });
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user) {
        const token = jwt.sign({ email }, process.env.ACCESS_TOKEN, {
          expiresIn: "5h",
        });
        return res.send({ accessToken: token });
      }
      res.status(403).send({ accessToken: "" });
    });
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ isAdmin: user?.isAdmin === true });
    });
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ isSeller: user?.role === "seller" });
    });
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ isBuyer: user?.role === "buyer" });
    });
    app.get("/watches", verifyJWT, verifySeller, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { sellerEmail: email };
      const cursor = await watchCollection.find(query).toArray();
      res.send(cursor);
    });
    app.get("/watches/brand/:brand", verifyJWT, async (req, res) => {
      const brand = req.params.brand;
      const filter = { brand: brand, status: "unsold" };
      const result = await watchCollection.find(filter).toArray();
      res.send(result);
    });
    app.get("/watches/single-brand/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await watchCollection.findOne(query);
      res.send(result);
    });
    app.get("/my-orders", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { buyerEmail: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/watches/all", verifyJWT, async (req, res) => {
      const query = { status: "unsold" };
      const result = await watchCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });
    app.get("/sellers-all", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "seller" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/buyers-all", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { role: "buyer" };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/reported-items", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { isReported: true };
      const result = await watchCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/advertised-items-3", async (req, res) => {
      const query = { isAdvertised: true };
      const result = await watchCollection.find(query).limit(3).toArray();
      res.send(result);
    });
    app.get("/advertise-all", async (req, res) => {
      const query = { isAdvertised: true };
      const result = await watchCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/featured-brand", async (req, res) => {
      const query = {};
      const result = await brandCollection.find(query).limit(3).toArray();
      res.send(result);
    });
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const order = req.body;
      const price = order.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const id = payment.orderId;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          paymentStatus: "paid",
          transactionId: payment.transactionId,
        },
      };
      const updatedResult = await orderCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.post("/watch/buy", verifyJWT, async (req, res) => {
      const details = req.body;
      const result = await orderCollection.insertOne(details);
      res.send(result);
    });
    app.post("/watches", verifyJWT, verifySeller, async (req, res) => {
      const watch = req.body;
      const result = await watchCollection.insertOne(watch);
      res.send(result);
    });
    app.put("/watch/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "sold",
        },
      };
      const result = await watchCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.put("/watches/single-brand/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isReported: true,
        },
      };
      const result = await watchCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    // temporarily update sell status
    // app.get("/watch", async (req, res) => {
    //   const filter = {};
    //   const options = { upsert: true };
    //   const updatedDoc = {
    //     $set: {
    //       status: "unsold",
    //     },
    //   };
    //   const result = await watchCollection.updateMany(
    //     filter,
    //     updatedDoc,
    //     options
    //   );
    //   res.send(result);
    // });
    app.put("/watches/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isAdvertised: true,
        },
      };
      const result = await watchCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.put("/my-orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "unsold",
        },
      };
      const result = await watchCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });
    app.delete("/my-orders/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
    app.delete("/watches/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await watchCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
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
