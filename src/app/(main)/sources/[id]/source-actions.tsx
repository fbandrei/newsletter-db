"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface SourceActionsProps {
  sourceId: string;
  initialSubscribed: boolean;
  initialFavorited: boolean;
}

export function SourceActions({
  sourceId,
  initialSubscribed,
  initialFavorited,
}: SourceActionsProps) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loadingSub, setLoadingSub] = useState(false);
  const [loadingFav, setLoadingFav] = useState(false);

  const toggleSubscribe = async () => {
    setLoadingSub(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
      });
      if (res.ok) setSubscribed(!subscribed);
    } finally {
      setLoadingSub(false);
    }
  };

  const toggleFavorite = async () => {
    setLoadingFav(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}/favorite`, {
        method: favorited ? "DELETE" : "POST",
      });
      if (res.ok) setFavorited(!favorited);
    } finally {
      setLoadingFav(false);
    }
  };

  return (
    <div className="flex gap-2 shrink-0">
      <Button
        variant={subscribed ? "secondary" : "primary"}
        size="sm"
        onClick={toggleSubscribe}
        loading={loadingSub}
      >
        {subscribed ? "Subscribed ✓" : "Subscribe"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleFavorite}
        loading={loadingFav}
      >
        {favorited ? "★ Favorited" : "☆ Favorite"}
      </Button>
    </div>
  );
}
