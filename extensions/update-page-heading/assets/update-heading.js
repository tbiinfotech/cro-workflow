
document.addEventListener("DOMContentLoaded", () => {
  const headingDiv = document.querySelector("[data-heading]");
  const headingVal =
    document.getElementById("cro-page-heading")?.dataset.pageMetafield;

  if (headingDiv && headingVal) {
    const target = headingDiv.querySelector("span");
    if (target) {
      // target.textContent = headingVal;
      target.innerHTML = headingVal;
    }
  }
})
