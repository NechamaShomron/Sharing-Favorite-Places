const { validationResult } = require("express-validator");
const fs = require("fs");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not find a place", 500)
    );
  }

  if (!place) {
    return next(
      new HttpError("Could not find a place for the provided id.", 400)
    );
  }
  res.json({ place: place.toObject({ getters: true }) }); //getter changes _id
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;
  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not find user", 500)
    );
  }

  if (!userWithPlaces || userWithPlaces.length == 0) {
    return next(
      new HttpError("Could not find a place for the provided user id."),
      404
    );
  }
  res.json({
    userPlaces: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

const createPlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    ); //next because async func
  }
  const { title, description, address } = req.body;

  let coordinates;
  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }
  const createdPlace = new Place({
    title,
    description,
    location: coordinates,
    address,
    image: req.file.path,
    creatorId: req.userData.userId,
  });

  //check if creator exists
  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Creating place failed, please try again", 500));
  }
  if (!user) {
    return next(new HttpError("Could not find user for provided id", 404));
  }

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await createdPlace.save({ session: session });
    //add place id to user
    user.places.push(createdPlace);
    await user.save({ session: session });
    await session.commitTransaction();
  } catch (err) {
    return next(new HttpError("Creating place failed, please try again", 500));
  }
  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data.", 422)
    );
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;
  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place.", 500)
    );
  }

  if (place.creatorId.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  place.title = title;
  place.description = description;
  try {
    await place.save();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update place", 500)
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;
  let place;
  try {
    place = await Place.findById(placeId).populate("creatorId");
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not delete place", 500)
    );
  }
  if (!place) {
    return next(new HttpError("Could not find a place for this id", 404));
  }

  if (place.creatorId.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401)
    );
  }

  const imagePath = place.image;

  try {
    const session = await mongoose.startSession();
    session.startTransaction();
    await place.remove({ session: session });
    place.creatorId.places.pull(place);
    await place.creatorId.save({ session: session });
    await session.commitTransaction();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not delete place", 500)
    );
  }
  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place" });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
