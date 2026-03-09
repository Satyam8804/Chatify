import { useState } from "react";
import { Link } from "react-router-dom";
import AvatarUpload from "./uploadAvatar";
import Loader from "../utils/Loader";

const AuthForm = ({ mode = "login", onSubmit, loading, setLoading }) => {
  const isLogin = mode === "login";
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fName: "",
    lName: "",
    avatar: null,
  });

  const handleChange = (e) => {
    const { name, value, files } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleNext = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "register") {
      const formDataToSend = new FormData();

      formDataToSend.append("email", formData.email);
      formDataToSend.append("password", formData.password);
      formDataToSend.append("fName", formData.fName);
      formDataToSend.append("lName", formData.lName);

      if (formData.avatar) {
        formDataToSend.append("avatar", formData.avatar);
      }

      onSubmit(formDataToSend);
    } else {
      onSubmit({
        email: formData.email,
        password: formData.password,
      });
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
      <h2 className="text-2xl font-bold text-center text-green-700 mb-6">
        {isLogin ? "Login to your account" : "Create a new account"}
      </h2>

      {/* LOGIN (single step) */}
      {isLogin && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            name="email"
            type="email"
            onChange={handleChange}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            onChange={handleChange}
          />

          <SubmitButton loading={loading} text="Login" />
        </form>
      )}

      {/* REGISTER STEP 1 */}
      {!isLogin && step === 1 && (
        <form onSubmit={handleNext} className="space-y-4">
          <Input
            label="Email"
            name="email"
            type="email"
            onChange={handleChange}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            onChange={handleChange}
          />

          <button className="w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 cursor-pointer">
            Continue
          </button>
        </form>
      )}

      {/* REGISTER STEP 2 */}
      {!isLogin && step === 2 && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 p-4 justify-center">
            <AvatarUpload onChange={handleChange} />
            <div className="flex gap-3 flex-col">
              <Input label="First Name" name="fName" onChange={handleChange} />
              <Input label="Last Name" name="lName" onChange={handleChange} />
            </div>
          </div>
          <SubmitButton loading={loading} text="Create Account" />
        </form>
      )}

      <p className="text-sm text-center text-gray-600 mt-6 font-semibold">
        {isLogin ? (
          <>
            Don’t have an account?{" "}
            <Link to="/register" className="text-green-700 hover:underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link to="/login" className="text-green-700 hover:underline">
              Login
            </Link>
          </>
        )}
      </p>
    </div>
  );
};

/* ---------- Reusable Components ---------- */

const Input = ({ label, name, type = "text", onChange }) => (
  <div className="w-full">
    <label className="block text-md font-medium text-gray-600 mb-1">
      {label}
    </label>
    <input
      type={type}
      name={name}
      onChange={(e) => onChange(e)}
      required
      className="w-full px-4 py-2 border-2 border-gray-500 rounded-lg "
    />
  </div>
);

const SubmitButton = ({ loading, text }) => (
  <button
    disabled={loading}
    className="w-full bg-green-700 text-white py-2 rounded-lg hover:bg-green-600 cursor-pointer disabled:opacity-60"
  >
    {loading ? <Loader /> : text}
  </button>
);

export default AuthForm;
