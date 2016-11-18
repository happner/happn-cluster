FROM ubuntu:14.04
MAINTAINER ig-grant

# Declare args
ARG NVM_DIR=$HOME/.nvm
ARG NVM_VERSION=0.32.0
ARG NODE_VERSION=4.6.2

#### General ####
RUN apt-get update && apt-get install -y curl wget git git-core curl build-essential

#### Install NVM (Node Version Manager) ####

# Replace sh with bash
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Install nvm with node and npm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.0/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Set up our PATH correctly so we don't have to long-reference npm, node, &c.
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

#### Clone Github repo ####

RUN mkdir -p home
RUN git clone https://github.com/happner/happn-cluster.git /home/happn-cluster

# Install npm dependencies
RUN cd /home/happn-cluster && npm install

#### Set up MongoDB ####

RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
RUN echo 'deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen' | tee /etc/apt/sources.list.d/10gen.list
RUN apt-get update && apt-get install -y mongodb-org
RUN mkdir -p /data/db

### Set up working directory
WORKDIR /home/happn-cluster

EXPOSE 8005

CMD mongod --fork --logpath mongodb.log && /bin/bash

# To build: sudo docker build --build-arg NODE_VERSION=4.* -t happner/happn-cluster:v1 .

# To run (PRODUCTION): sudo docker run -p 8005:8005 -it --rm happner/happn-cluster:v1

# Inspect: sudo docker inspect [container_id]
# Delete all containers: sudo docker rm $(sudo docker ps -a -q)
# Delete all images: sudo docker rmi $(sudo docker images -q)
# Connect to running container: sudo docker exec -it [container_id] bash
# Attach to running container: sudo docker attach [container_id]
# Detach from running container without stopping process: Ctrl-p Ctrl-q
# Restart Docker service: sudo service docker.io restart
