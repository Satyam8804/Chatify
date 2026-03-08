const getInitials = (fName,lName)=>{
    if(!lName) return fName[0].toUpperCase();
    return (fName[0]+lName[0]).toUpperCase();
}

export default getInitials;