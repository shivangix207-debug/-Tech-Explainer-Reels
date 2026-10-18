const Spinner = ({ full = false, size = "md" }) => {
  const sizes = { sm: "h-5 w-5 border-2", md: "h-8 w-8 border-2", lg: "h-12 w-12 border-4" };
  const spinner = (
    <div className={`${sizes[size]} rounded-full border-brand-500 border-t-transparent animate-spin`} />
  );

  if (full) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        {spinner}
      </div>
    );
  }
  return spinner;
};

export default Spinner;
