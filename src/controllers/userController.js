// controllers/userController.js
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { AsyncHandler } from '../utils/AsyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import knex from '../db/db.js';
import jwt from 'jsonwebtoken';

// Helper to generate tokens
const generateTokens = async (userId) => {
    const user = await User.findById(userId);
    const accessToken = User.generateAccessToken(user);
    const refreshToken = User.generateRefreshToken(user);
    await User.saveRefreshToken(user.id, refreshToken);
    return { accessToken, refreshToken };
};


// Refresh Access Token
export const refreshAccessToken = AsyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
      throw new ApiError(401, "Refresh token is required");
  }

  try {
      const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || user.refreshToken !== incomingRefreshToken) {
          throw new ApiError(403, "Invalid refresh token");
      }

      const newAccessToken = User.generateAccessToken(user);
      const newRefreshToken = User.generateRefreshToken(user);

      await User.saveRefreshToken(user.id, newRefreshToken);

      const options = { httpOnly: true, secure: true };
      res
          .status(200)
          .cookie("accessToken", newAccessToken, options)
          .cookie("refreshToken", newRefreshToken, options)
          .json(new ApiResponse(200, { accessToken: newAccessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"));
  } catch (error) {
      throw new ApiError(401, "Invalid refresh token");
  }
});


// Register a new user

// controllers/userController.js

// import User from '../models/User.js';
// import { asyncHandler } from '../utils/AsyncHandler.js';
// import { ApiError } from '../utils/ApiError.js';
// import { ApiResponse } from '../utils/ApiResponse.js';
// import { uploadOnCloudinary } from '../utils/cloudinary.js';
// import { generateTokens } from '../utils/tokenUtils.js';  // assuming you have a function to generate tokens

// Helper function for phone validation (example format: +123456789 or 123456789)
const validatePhoneNumber = (phone) => {
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    return phoneRegex.test(phone);
};

// Helper function for address validation (example: no special characters except comma and period)
const validateAddress = (address) => {
    const addressRegex = /^[a-zA-Z0-9\s,.'-]{3,}$/;
    return addressRegex.test(address);
};

// Register a new user
export const registerUser = AsyncHandler(async (req, res) => {
    const { username, email, address, phone, password } = req.body;

    // Check if required fields are present
    if (!username || !address || !phone || !password) {
        throw new ApiError(400, "Username, address, phone, and password are required");
    }

    // Validate username uniqueness
    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
        throw new ApiError(409, "Username is already taken");
    }

    // Validate phone format
    if (!validatePhoneNumber(phone)) {
        throw new ApiError(400, "Phone number is invalid. Please enter a valid phone number.");
    }

    // Validate address format
    if (!validateAddress(address)) {
        throw new ApiError(400, "Address is invalid. Please enter a valid address.");
    }

    // Check for existing user with the same details
    const existingUser = await User.findDuplicateUser({ username, address, phone });
    if (existingUser) {
        throw new ApiError(409, "User with these details already exists. Please try logging in.");
    }

    // Handle avatar upload if provided
    const avatarLocalPath = req.file?.path;
    const avatar = avatarLocalPath ? await uploadOnCloudinary(avatarLocalPath) : null;

    // Create user
    const user = await User.create({
        username,
        email,
        address,
        phone,
        password,
        avatar: avatar ? avatar.url : null,
    });

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    res.status(201).json(
        new ApiResponse(201, { user, accessToken, refreshToken }, "User registered successfully")
    );
});



//login user:
// controllers/userController.js

export const loginUser = AsyncHandler(async (req, res) => {
    const { credential, password } = req.body;

    console.log(`Hitting login User: \n Credential: ${credential}`);

    // Check if credential is provided
    if (!credential || !password) {
        throw new ApiError(400, "Credential and password are required");
    }

    // Determine if credential is email, username, or phone
    let user;
    if (credential.includes('@')) {
        user = await User.findByEmail(credential);  // Treat credential as an email
    } else if (/^\d+$/.test(credential)) {
        user = await User.findByPhone(credential);  // Treat credential as a phone number
    } else {
        user = await User.findByUsername(credential);  // Treat credential as a username
    }

    // Validate password
    if (!user || !(await User.isPasswordCorrect(password, user.password))) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    res.status(200)
        .cookie("accessToken", accessToken, { httpOnly: true })
        .cookie("refreshToken", refreshToken, { httpOnly: true })
        .json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged in successfully"));
});

// export const registerUser = AsyncHandler(async (req, res) => {

//     const { username, address, phone, password } = req.body;
//     if (!username || !address || !phone || !password) {
//         throw new ApiError(400, "Username, address, phone, and password are required");
//     }

//     const existingUser = await User.findByEmail(email);
//     if (existingUser) {
//         throw new ApiError(409, "User with this email already exists");
//     }

//     const avatarLocalPath = req.file?.path;
//     const avatar = avatarLocalPath ? await uploadOnCloudinary(avatarLocalPath) : null;

//     const user = await User.create({
//         username,
//         email,
//         password,
//         avatar: avatar ? avatar.url : null
//     });

//     const { accessToken, refreshToken } = await generateTokens(user.id);

//     res.status(201).json(
//         new ApiResponse(201, { user, accessToken, refreshToken }, "User registered successfully")
//     );
// });

// Login user


// export const loginUser = AsyncHandler(async (req, res) => {
//     const { email, password } = req.body;
//     console.log(`Hitting login User: \n Email: ${email}`);
    
//     const user = await User.findByEmail(email);

//     if (!user || !(await User.isPasswordCorrect(password, user.password))) {
//         throw new ApiError(401, "Invalid email or password");
//     }

//     const { accessToken, refreshToken } = await generateTokens(user.id);

//     res.status(200)
//         .cookie("accessToken", accessToken, { httpOnly: true })
//         .cookie("refreshToken", refreshToken, { httpOnly: true })
//         .json(new ApiResponse(200, { user, accessToken, refreshToken }, "User logged in successfully"));
// });


// logout user






export const logoutUser = AsyncHandler(async (req, res) => {
  // Clear refresh token from database
  await User.saveRefreshToken(req.user.id, null);

  // Clear access and refresh tokens from cookies
  const options = { httpOnly: true, secure: true };
  return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// Get current user's profile
export const getCurrentUserProfile = AsyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError(404, "User not found");
    res.status(200).json(new ApiResponse(200, user, "User profile fetched successfully"));
});

// Update user profile
export const updateUserProfile = AsyncHandler(async (req, res) => {
    const { email, phone, district, city, country, town, address, profession, age, education } = req.body;
    const avatarLocalPath = req.file?.path;
    const avatar = avatarLocalPath ? await uploadOnCloudinary(avatarLocalPath) : null;

    console.log(
      `Hitting update profile:\n
      email = ${email}, 
      phone= ${phone}, 
      district = ${district}, 
      city = ${city}, 
      country = ${country}, 
      town = ${town}, 
      address = ${address}, 
      profession = ${profession}, 
      age = ${age}, 
      education = ${education}`
    )

    const updatedUser = await User.update(req.user.id, {
        email,
        phone,
        district,
        city,
        country,
        town,
        address,
        profession,
        age,
        education,
        avatar: avatar ? avatar.url : undefined
    });

    if (!updatedUser) throw new ApiError(500, "Error updating profile");

    res.status(200).json(new ApiResponse(200, updatedUser, "User profile updated successfully"));
});

// // Get user's interested events
// export const getUserInterestedEvents = AsyncHandler(async (req, res) => {
//     const user = await User.findById(req.user.id);
//     if (!user) throw new ApiError(404, "User not found");

//     console.log("Hitting userInterestedEvents: ")
//     const interestedEvents = await knex('users')
//         .whereIn('id', user.interested_in)
//         .select('*');

//     res.status(200).json(new ApiResponse(200, interestedEvents, "Interested events fetched successfully"));
// });

// Get user's interested events 
export const getUserInterestedEvents = AsyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  // Check if interested_in is an array and has elements
  if (!Array.isArray(user.interested_in) || user.interested_in.length === 0) {
      return res.status(200).json(new ApiResponse(200, [], "No interested events found"));
  }

  const interestedEvents = await knex('events')
      .whereIn('id', user.interested_in)
      .select('*');

  res.status(200).json(new ApiResponse(200, interestedEvents, "Interested events fetched successfully"));
});



// to mark or unmark an event as interested by the user
export const toggleInterested = AsyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const userId = req.user.id;

    // Check if event exists
    const eventExists = await knex('events').where({ event_id: eventId }).first();
    if (!eventExists) {
        throw new ApiError(404, 'Event not found');
    }

    // Check if the event is already in the user's interested list
    const user = await User.findById(userId);
    const isInterested = user.interested_in && user.interested_in.includes(parseInt(eventId));

    if (isInterested) {
        // Remove from interested list
        await knex('users')
            .where({ id: userId })
            .update({
                interested_in: knex.raw('array_remove(interested_in, ?)', [eventId])
            });
        res.status(200).json(new ApiResponse(200, {}, 'Event removed from interested list'));
    } else {
        // Add to interested list
        await User.addInterest(userId, eventId);
        res.status(200).json(new ApiResponse(200, {}, 'Event added to interested list'));
    }
});












// import User from '../models/User.js';
// import {AsyncHandler} from '../utils/AsyncHandler.js';
// import {ApiResponse} from '../utils/ApiResponse.js';
// import {ApiError} from '../utils/ApiError.js';
// import {uploadOnCloudinary} from '../utils/cloudinary.js';

// export const createUser = AsyncHandler(async (req, res) => {
//   const { username, email, phone, password } = req.body;
//   const avatar = req.file ? await uploadOnCloudinary(req.file.path) : null;

//   const newUser = await User.create({
//     username, email, phone, password,
//     avatar_url: avatar ? avatar.secure_url : null
//   });

//   res.status(201).json(new ApiResponse(201, newUser, 'User created successfully'));
// });

// export const getUser = AsyncHandler(async (req, res) => {
//   const user = await User.findById(req.params.id);
//   if (!user) throw new ApiError(404, 'User not found');
//   res.json(new ApiResponse(200, user, 'User retrieved successfully'));
// });
