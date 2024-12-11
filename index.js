let express = require("express");
let app = express();
let path = require("path");

app.use(express.urlencoded({ extended: true }));

// -----> Connect Database here
const knex = require("knex")({
  client: "pg",
  connection: {
    host: "localhost",
    user: "postgres",
    password: "DallensPostMalazan21",
    database: "403Project",
    port: 5432,
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
app.get("/addVolunteer", (req, res) => {
  knex("Referral")
    .select("ReferralID", "ReferralName")
    .then((Referral) => res.render("addVolunteer", { Referral }))
    .catch((error) => {
      console.error("Error fetching Referral:", error);
      res.status(500).send("Internal Server Error");
    });
});

app.post("/addEmployee", (req, res) => {
  const VolFirstName = req.body.VolFirstName.toUpperCase() || "";
  const VolLastName = req.body.VolLastName.toUpperCase() || "";
  const Phone = req.body.Phone || "";
  const Email = req.body.Email || "";
  const VolCity = req.body.VolCity.toUpperCase() || "";
  const VolCounty = req.body.VolCounty.toUpperCase() || "";
  const VolState = req.body.VolState.toUpperCase() || "";
  const ReferralID = parseInt(req.body.ReferralID);
  const SewingLevel = req.body.SewingLevel || "B";
  const HoursPerMonth = parseInt(req.body.HoursPerMonth) || null;

  knex("Volunteer")
    .insert({
      VolFirstName,
      VolLastName,
      Phone,
      Email,
      VolCity,
      VolCounty,
      VolState,
      ReferralID,
      SewingLevel,
      HoursPerMonth,
    })
    .then(() => res.redirect("/"))
    .catch((error) => {
      console.error("Error Adding Volunteer:", error);
      res.status(500).send("Internal Server Error");
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

// -----> View Certifications
app.get("/viewCertifications", (req, res) => {
  const searchQuery = req.query.search || "";  // Get the search query from the request

  knex("Student_Certifications as sc")
    .join("Employees as e", "sc.EmployeeID", "e.EmployeeID")
    .join("Certifications as c", "sc.CertificationID", "c.CertificationID")
    .select(
      "e.EmpFirstName",
      "e.EmpLastName",
      "c.CertDescription",
      "sc.CertGrade"
    )
    .where("e.EmpFirstName", "ILIKE", `%${searchQuery}%`) // Search by employee first name
    .orWhere("e.EmpLastName", "ILIKE", `%${searchQuery}%`) // Or search by employee last name
    .then((certificationsData) => {
      res.render("viewCertifications", {
        certificationsData,
        searchQuery,  // Pass the search query to the template
      });
    })
    .catch((error) => {
      console.error("Error fetching certifications data:", error);
      res.status(500).send("Internal Server Error");
    });
});

// -----> Add Certification
app.post("/addCertification", (req, res) => {
  const { EmployeeID, CertificationID, Grade, CertificationDate } = req.body;

  knex("Employee_Certifications")
    .insert({
      EmployeeID,
      CertificationID,
      Grade,
      CertificationDate,
    })
    .then(() => res.redirect("/viewCertifications")) // Redirect to viewCertifications after successful insert
    .catch((error) => {
      console.error("Error adding certification:", error);
      res.status(500).send("Internal Server Error");
    });
});

// GET route for editing certifications
app.get("/editCertifications", (req, res) => {
  const { EmployeeID, CertificationID } = req.query;

  // Validate if the required parameters are present
  if (!EmployeeID) {
    return res.status(400).send("Missing get employeeid");
  }
  if (!CertificationID) {
    return res.status(400).send("Missing get certificationid");
  }

  // Fetch the required data from the three tables
  Promise.all([
    knex("Student_Certifications")
      .where("CertificationID", CertificationID)
      .where("EmployeeID", EmployeeID)
      .first(), // Use first() to get a single object instead of an array
    knex("Employees")
      .where("EmployeeID", EmployeeID)
      .first(),
    knex("Certifications")
      .where("CertificationID", CertificationID)
      .first()
  ])
    .then(([certification, employee, certDescription]) => {
      if (!certification || !employee || !certDescription) {
        return res.status(404).send("Employee, Certification, or Description not found");
      }

      // Pass the data to the editCertifications page
      res.render("editCertifications", {
        Certification: certification,
        Employee: employee,
        CertDescription: certDescription.CertDescription
      });
    })
    .catch((err) => {
      console.error("Error fetching data:", err);
      res.status(500).send("Internal Server Error");
    });
});

// POST route for updating certifications
app.post("/editCertifications", (req, res) => {
  const { EmployeeID, CertificationID, CertGrade } = req.body;

  // Validate inputs
  if (!EmployeeID) {
    return res.status(400).send("Missing post employeeid");
  }
  if (!CertificationID) {
    return res.status(400).send("Missing post certificationid");
  }

  // Update the certification grade
  knex("Student_Certifications")
    .where({
      EmployeeID: EmployeeID,
      CertificationID: CertificationID
    })
    .update({
      CertGrade: CertGrade
    })
    .then(() => {
      res.redirect("/viewCertifications");
    })
    .catch((err) => {
      console.error("Error updating certification:", err);
      res.status(500).send("Internal Server Error");
    });
});

// Route for internal page (after login)
app.get("/internal", (req, res) => {
  res.render("internal");
});

// Start the server
app.listen(3000, () => console.log("server started"));
