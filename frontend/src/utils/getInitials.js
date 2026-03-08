export const getInitials = (fName = "", lName = "") => {
  return (
    fName.charAt(0).toUpperCase() +
    lName.charAt(0).toUpperCase()
  );
};
