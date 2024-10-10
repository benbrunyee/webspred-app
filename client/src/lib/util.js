export const capitalizeCamelCase = (str) => {
  // Split on capital letters
  const words = str.split(/(?=[A-Z])/);
  // Capitalize each word
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
