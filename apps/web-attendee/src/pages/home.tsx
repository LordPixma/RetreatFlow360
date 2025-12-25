import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, MapPin, Users, Sparkles, Heart, Shield } from 'lucide-react';
import { Button, Card, CardContent } from '@retreatflow360/ui';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/10 py-20 lg:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Discover Your{' '}
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Perfect Retreat
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-6 text-lg text-muted-foreground"
            >
              Join transformative experiences that nurture your mind, body, and soul. From yoga
              retreats to wellness workshops, find your next adventure.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Button size="xl" asChild>
                <Link to="/events">
                  Explore Events
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/auth/register">Create Account</Link>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-96 w-96 rounded-full bg-secondary/20 blur-3xl" />
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Why Choose RetreatFlow360</h2>
            <p className="mt-4 text-muted-foreground">
              Everything you need for an unforgettable retreat experience
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Calendar,
                title: 'Easy Booking',
                description:
                  'Book your spot in minutes with our streamlined registration process.',
              },
              {
                icon: MapPin,
                title: 'Amazing Venues',
                description:
                  'Discover retreats in stunning locations around the world.',
              },
              {
                icon: Users,
                title: 'Community',
                description:
                  'Connect with like-minded individuals on your wellness journey.',
              },
              {
                icon: Sparkles,
                title: 'Curated Experiences',
                description:
                  'Hand-picked retreats that offer transformative experiences.',
              },
              {
                icon: Heart,
                title: 'Personalized Care',
                description:
                  'Dietary preferences and accessibility needs are always accommodated.',
              },
              {
                icon: Shield,
                title: 'Secure Payments',
                description:
                  'Your payments are protected with industry-standard security.',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="h-full transition-shadow hover:shadow-lg">
                  <CardContent className="pt-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Ready to Transform Your Life?</h2>
            <p className="mt-4 text-muted-foreground">
              Join thousands of others who have discovered the power of retreat experiences.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild>
                <Link to="/events">
                  Browse All Retreats
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
