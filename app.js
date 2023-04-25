const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeServerAndDB = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Listen to port http://localhost:3000");
    });
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initializeServerAndDB();

const convertStateContent = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictContent = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

//post userDetails API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticationOfToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//get /states/ API
app.get("/states/", authenticationOfToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT 
            * 
        FROM 
            state 
        ORDER BY 
            state_id;
    `;
  const statesArray = await db.all(getStateQuery);
  response.send(statesArray.map((eachItem) => convertStateContent(eachItem)));
});

//get /states/:stateId/ API
app.get(
  "/states/:stateId/",
  authenticationOfToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateQuery = `
        SELECT 
        * 
        FROM 
        state 
        WHERE state_id = ${stateId};
    `;
    const state = await db.get(getStateQuery);
    response.send(convertStateContent(state));
  }
);

//Get /districts/ API
app.get("/districts/", authenticationOfToken, async (request, response) => {
  const getStatesQuery = `
        SELECT 
        * 
        FROM
        district 
        ORDER BY 
        district_id;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray.map((eachItem) => convertStateContent(eachItem)));
});

//Get /districts/:districtId/ API
app.get(
  "/districts/:districtId/",
  authenticationOfToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        SELECT 
        * 
        FROM 
        district 
        WHERE district_id = ${districtId};
    `;
    const district = await db.get(getDistrictQuery);
    response.send(convertDistrictContent(district));
  }
);

///districts/:districtId/
app.delete(
  "/districts/:districtId/",
  authenticationOfToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
        DELETE  
        FROM 
        district 
        WHERE district_id = ${districtId};
    `;
    const district = await db.get(getDistrictQuery);
    response.send("District Removed");
  }
);

//POST /districts/ API
app.post("/districts/", authenticationOfToken, async (request, response) => {
  const {
    districtId,
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = request.body;
  const addDistrictQuery = `
        INSERT INTO 
        district (district_name,state_id,cases,cured,active,deaths)
        VALUES (
            '${districtName}',
            ${stateId},
            ${cases},
            ${cured},
            ${active},
            ${deaths}
        );
    `;
  const dbResponse = await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//Put district API
app.put(
  "/districts/:districtId/",
  authenticationOfToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
        UPDATE 
        district 
        SET 
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE 
            district_id = ${districtId};
    `;
    const updateDistrict = await db.get(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//get stats API
app.get(
  "/states/:stateId/stats/",
  authenticationOfToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
        SELECT 
            SUM(cases) AS totalCases,
            SUM(cured) AS totalCured,
            SUM(active) AS totalActive,
            SUM(deaths) AS totalDeaths
        FROM 
            district 
        WHERE state_id = ${stateId}; 
    `;
    const dbResponse = await db.get(getStatsQuery);
    response.send(dbResponse);
  }
);

module.exports = app;
