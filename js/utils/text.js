export function shortenDisplayName(fullName, surnameLength = 3) {
    if (typeof fullName !== "string") {
        return "";
    }

    const cleanedName = fullName.replace(/\(Assign\)/gi, "").replace(/\s+/g, " ").trim();
    if (!cleanedName) {
        return "";
    }

    const [firstName, ...surnameParts] = cleanedName.split(" ");
    if (surnameParts.length === 0) {
        return firstName;
    }

    const surname = surnameParts.join("").replace(/[^A-Za-z]/g, "");
    if (!surname) {
        return firstName;
    }

    return `${firstName} ${surname.slice(0, surnameLength)}`;
}