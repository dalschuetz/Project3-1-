let express = require("express");
let app = express();
let path = require("path");
const port = process.env.PORT || 3000; 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// -----> Connect Database here
const knex = require("knex")({
  client: "pg",
  connection: {
    host: process.env.RDS_HOSTNAME|| "localhost",
    user: process.env.RDS_USERNAME || "postgres",
    password: process.env.RDS_PASSWORD || "DallensPostMalazan21",
    database: process.env.RDS_DB_NAME || "403Project",
    port: process.env.RDS_PORT || 5432,
    ssl: process.env.DB_SSL ? {rejectUnauthorized: false} : false
  },
});

// -----> Set Views (for HTML files) and Public (for CSS/pics)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// -----> put all routes below

// Main Page
app.get("/", (req, res) => res.render("index"));

// Login Page
app.get("/login", (req, res) => res.render("login", { error: null }));

// Login Form Submission
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await knex("Admins")
      .where({ username: username, password: password })
      .first();

    if (user) {
      res.redirect("/internal");
    } else {
      res.redirect("/");
    }
  } catch (error) {
    console.error("Error querying database:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Add Volunteer Loading and Posting
// GET route to fetch attendance options and render the form
app.get("/addAttendance", (req, res) => {
  // Fetch Attendance descriptions to populate dropdown or display options
  knex("Attendance")
    .select("AttendanceID", "AttenDescription")
    .then((attendanceOptions) => {
      // Fetch employees to potentially link attendance
      return knex("Employees")
        .select("EmployeeID", "EmpFirstName", "EmpLastName")
        .then((employees) => {
          res.render("addAttendance", { 
            attendanceOptions, 
            employees 
          });
        });
    })
    .catch((error) => {
      console.error("Error fetching Attendance or Employees:", error);
      res.status(500).send("Internal Server Error");
    });
});

// POST route to add attendance record
app.post("/addAttendance", (req, res) => {
  // Extract data from request body
  const {
    EmployeeID,
    AttendanceID,
    AttenDate,
    AttenPointValue
  } = req.body;

  // Validate required fields
  if (!EmployeeID || !AttendanceID || !AttenDate || !AttenPointValue) {
    return res.status(400).send("Missing required attendance information");
  }

  // Begin transaction to ensure data integrity
  knex.transaction(async (trx) => {
    try {
      // Insert into Employee_Attendance table
      await trx("Employee_Attendance")
        .insert({
          EmployeeID: parseInt(EmployeeID),
          AttendanceID: parseInt(AttendanceID),
          AttenDate: new Date(AttenDate),
          AttenPointValue: parseInt(AttenPointValue)
        });

      // Commit the transaction
      await trx.commit();

      // Redirect on successful insertion
      res.redirect("/");
    } catch (error) {
      // Rollback the transaction in case of error
      await trx.rollback();

      console.error("Error Adding Attendance Record:", error);
      res.status(500).send("Internal Server Error");
    }
  });
});

// -----> View Attendance
app.get("/viewAttendance", (req, res) => {
  const searchQuery = req.query.search || ""; // Get the search query from the request

  knex("Employee_Attendance as ea")
    .join("Employees as e", "ea.EmployeeID", "e.EmployeeID")
    .join("Attendance as a", "ea.AttendanceID", "a.AttendanceID")
    .select(
      "ea.AttendanceID",
      "e.EmpFirstName",
      "e.EmpLastName",
      "ea.AttenDate",
      "ea.AttenPointValue",
      "a.AttenDescription"
    )
    .where("e.EmpFirstName", "ILIKE", `%${searchQuery}%`)  // Search by employee first name
    .orWhere("e.EmpLastName", "ILIKE", `%${searchQuery}%`) // Or search by employee last name
    .orderBy("ea.AttenDate", "desc")
    .then((attendanceData) => {
      // Render the view with the filtered data and the search query
      res.render("viewAttendance", {
        attendanceData,
        searchQuery,  // Pass the search query to the template
      });
    })
    .catch((error) => {
      console.error("Error fetching attendance data:", error);
      res.status(500).send("Internal Server Error");
    });
});


// -----> Edit Attendance
app.get("/editAttendance/:AttendanceID", (req, res) => {
  const AttendanceID = req.params.AttendanceID;

  // Fetch the attendance record to edit
  knex("Employee_Attendance")
    .where("AttendanceID", AttendanceID)
    .first()
    .then((attendance) => {
      if (!attendance) {
        return res.status(404).send("Attendance not found");
      }

      // Fetch all attendance descriptions and their point values
      knex("Attendance")
        .select("AttenDescription", "AttendanceID")
        .then((descriptions) => {
          // Render the editAttendance view with both the attendance record and descriptions
          res.render("editAttendance", {
            attendance: attendance,
            descriptions: descriptions,
          });
        })
        .catch((error) => {
          console.error("Error fetching descriptions:", error);
          res.status(500).send("Error fetching descriptions");
        });
    })
    .catch((error) => {
      console.error("Error fetching attendance record:", error);
      res.status(500).send("Error fetching attendance record");
    });
});

app.post("/editAttendance/:AttendanceID", (req, res) => {
  const AttendanceID = req.params.AttendanceID;
  const { AttenDate, AttenPointValue, AttenDescription } = req.body;

  // Update the description in the Attendance table
  knex("Attendance")
    .where("AttendanceID", AttendanceID)
    .update({
      AttenDescription
    })
    .then(() => {
      // Update the date and point value in the Employee_Attendance table
      return knex("Employee_Attendance")
        .where("AttendanceID", AttendanceID)
        .update({
          AttenDate,
          AttenPointValue
        });
    })
    .then(() => res.redirect("/viewAttendance"))
    .catch((error) => {
      console.error("Error updating attendance:", error);
      res.status(500).send("Internal Server Error");
    });
});

// -----> Delete Attendance
app.post("/deleteAttendance/:AttendanceID", (req, res) => {
  const AttendanceID = req.params.AttendanceID;

  knex("Employee_Attendance")
    .where("AttendanceID", AttendanceID)
    .del()
    .then(() => res.redirect("/viewAttendance"))
    .catch((error) => {
      console.error("Error deleting attendance record:", error);
      res.status(500).send("Internal Server Error");
    });
});




app.get("/viewEmployees", (req, res) => {
  const searchQuery = req.query.search || ""; // Get the search query from the request

  knex("Employees")
    .select(
      "EmployeeID",
      "EmpFirstName",
      "EmpLastName",
      "EmpAreaCode",
      "EmpPhoneNumber"
    )
    .where("EmpFirstName", "ILIKE", `%${searchQuery}%`)  // Search by employee first name
    .orWhere("EmpLastName", "ILIKE", `%${searchQuery}%`) // Or search by employee last name
    .orderBy("EmpLastName", "desc")
    .then((EmployeeData) => {
      // Render the view with the filtered data and the search query
      res.render("viewEmployees", {
        EmployeeData,
        searchQuery,  // Pass the search query to the template
      });
    })
    .catch((error) => {
      console.error("Error fetching attendance data:", error);
      res.status(500).send("Internal Server Error");
    });
});


// -----> Edit Attendance
app.get('/editEmployee/:EmployeeID', (req, res) => {
  let EmployeeID = req.params.EmployeeID;
  // Query the Pokémon by ID first
  knex('Employees')
    .where('EmployeeID', EmployeeID)
    .first()
    .then(Employee => {
      if (!Employee) {
        return res.status(404).send('Employee not found');
      }
      res.render('editEmployees', { Employee });
    })
    .catch(error => {
      console.error('Error fetching Employee for editing:', error);
      res.status(500).send('Internal Server Error');
    });
});


app.post('/editEmployee/:EmployeeID', (req, res) => {
  console.log('Received form data:', req.body); // Log form data

  const EmployeeID = req.params.EmployeeID;
  const EmpFirstName = req.body.EmpFirstName;
  const EmpLastName = req.body.EmpLastName;
  const EmpAreaCode = req.body.EmpAreaCode;
  const EmpPhoneNumber = req.body.EmpPhoneNumber;

  knex('Employees')
    .where('EmployeeID', EmployeeID)
    .update({
      EmpFirstName: EmpFirstName,
      EmpLastName: EmpLastName,
      EmpAreaCode: EmpAreaCode,
      EmpPhoneNumber: EmpPhoneNumber,
    })
    .then(() => {
      console.log('Update successful for EmployeeID:', EmployeeID);
      res.redirect('/viewEmployees');
    })
    .catch(error => {
      console.error('Error updating Employees:', error);
      res.status(500).send('Internal Server Error');
    });
});


app.post('/deleteEmployee/:EmployeeID', (req, res) => {
  const EmployeeID = req.params.EmployeeID; // Capture EmployeeID from URL parameter

  // Debugging: Log the EmployeeID
  console.log('Attempting to delete EmployeeID:', EmployeeID);

  // Query the Employee table
  knex('Employees') // Correct table name
    .where('EmployeeID', EmployeeID) // Correct column name
    .del() // Delete the record
    .then((rowsAffected) => {
      // Debugging: Log the rows affected
      console.log(`Rows deleted: ${rowsAffected}`);

      if (rowsAffected === 0) {
        // Handle case where no rows are deleted (EmployeeID not found)
        return res.status(404).send('Employee not found or already deleted.');
      }
      res.redirect('/viewEmployees'); // Redirect after successful deletion
    })
    .catch((error) => {
      // Log the error for troubleshooting
      console.error('Error deleting Employee:', error);
      res.status(500).send('Internal Server Error');
    });
});

// Render Add Employee Page

app.get("/addEmployee", (req, res) => res.render("addEmployee", { data: "Employee" }));


// Insert Employee Data into the Database

app.post("/addEmployee", (req, res) => {

  // Access employee data from req.body

  const EmpFirstName = req.body.EmpFirstName || '';

  const EmpLastName = req.body.EmpLastName|| '';

  const EmpAreaCode = req.body.EmpAreaCode || '';

  const EmpPhoneNumber = req.body.EmpPhoneNumber || '';


  // Check for required fields

  if (!EmpFirstName || !EmpLastName || !EmpAreaCode || !EmpPhoneNumber) {

    return res.status(400).send('All fields are required.');

  }


  // Insert data into the Employees table

  knex('Employees')

    .insert({

      EmpFirstName: EmpFirstName,

      EmpLastName: EmpLastName,

      EmpAreaCode: EmpAreaCode,

      EmpPhoneNumber: EmpPhoneNumber,

    })

    .then(() => {

      res.redirect("/internal"); // Redirect to the home page or a success page

    })

    .catch((error) => {

      console.error('Error Adding Employee:', error);

      res.status(500).send('Internal Server Error');

    });

});


// Route for internal page (after login)
app.get("/internal", (req, res) => {
  res.render("internal");
});

// Start the server
app.listen(process.env.PORT || 3000, () => console.log("server started"));
