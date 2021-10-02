const express = require("express");
const { check } = require("express-validator");

const placesConrollers = require("../controllers/places-controllers");
const fileUpload = require("../middleware/file-upload");
const checkAuth = require("../middleware/check-auth");

const router = express.Router();

router.get("/:pid", placesConrollers.getPlaceById);

router.get("/user/:uid", placesConrollers.getPlacesByUserId);

router.use(checkAuth);

router.post(
  "/",
  fileUpload.single("image"),
  [
    check("title").not().isEmpty(),
    check("description").isLength({ min: 5 }),
    check("address").not().isEmpty(),
  ],
  placesConrollers.createPlace
);

router.patch(
  "/:pid",
  [check("title").not().isEmpty(), check("description").isLength({ min: 5 })],
  placesConrollers.updatePlace
);

router.delete("/:pid", placesConrollers.deletePlace);

module.exports = router;
