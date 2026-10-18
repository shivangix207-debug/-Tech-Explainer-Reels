import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { categoriesApi } from "../services/endpoints";
import Spinner from "../components/Spinner";
import { ArrowRight } from "lucide-react";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    categoriesApi.list().then(({ data }) => setCategories(data.categories)).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner full />;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold mb-6">All Categories</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((c) => (
          <Link key={c._id} to={`/reels?category=${c._id}`} className="card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all group">
            <div className="h-12 w-12 rounded-xl mb-4 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: c.color }}>
              {c.name[0]}
            </div>
            <h3 className="font-bold text-lg mb-1">{c.name}</h3>
            <p className="text-sm text-ink-light/60 dark:text-ink-dark/50 mb-4">{c.reelCount} reels available</p>
            <span className="text-sm font-medium text-brand-600 flex items-center gap-1 group-hover:gap-2 transition-all">
              Explore <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Categories;
